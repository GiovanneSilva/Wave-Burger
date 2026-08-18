import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { StockService } from './stock.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('StockService', () => {
  let service: StockService;
  let prisma: any;
  let audit: { record: jest.Mock };

  const ingredient = { id: 'ing-1', standardUnit: 'kg', minimumStock: '10.0000' };
  const businessUnit = { id: 'bu-1' };

  beforeEach(() => {
    prisma = {
      ingredient: { findFirst: jest.fn() },
      businessUnit: { findFirst: jest.fn() },
      stockBalance: { findUnique: jest.fn(), upsert: jest.fn(), findMany: jest.fn() },
      stockMovement: { create: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new StockService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  function mockTransaction(existingBalance: any, movementReturn: any, balanceReturn: any) {
    const txClient = {
      stockBalance: {
        findUnique: jest.fn().mockResolvedValue(existingBalance),
        upsert: jest.fn().mockResolvedValue(balanceReturn),
      },
      stockMovement: { create: jest.fn().mockResolvedValue(movementReturn) },
    };
    prisma.$transaction.mockImplementation(async (fn: any) => fn(txClient));
    return txClient;
  }

  describe('applyMovement — entrada (IN)', () => {
    it('cria saldo do zero quando ainda não existe (primeira movimentação)', async () => {
      prisma.ingredient.findFirst.mockResolvedValue(ingredient);
      prisma.businessUnit.findFirst.mockResolvedValue(businessUnit);
      mockTransaction(null, { id: 'mov-1' }, { currentQuantity: '5.0000' });

      const result = await service.applyMovement({
        organizationId: 'org-1',
        businessUnitId: 'bu-1',
        ingredientId: 'ing-1',
        direction: 'IN',
        source: 'PURCHASE',
        quantity: 5,
        unit: 'kg',
        purchaseId: 'pur-1',
        performedByUserId: 'user-1',
      });

      expect(result.balance.currentQuantity).toBe('5.0000');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STOCK_ENTRY', entity: 'StockMovement' }),
      );
    });

    it('converte unidade antes de aplicar ao saldo (g -> kg)', async () => {
      prisma.ingredient.findFirst.mockResolvedValue(ingredient);
      prisma.businessUnit.findFirst.mockResolvedValue(businessUnit);
      const tx = mockTransaction(
        { currentQuantity: '1.0000' },
        { id: 'mov-1' },
        { currentQuantity: '1.16' },
      );

      await service.applyMovement({
        organizationId: 'org-1',
        businessUnitId: 'bu-1',
        ingredientId: 'ing-1',
        direction: 'IN',
        source: 'MANUAL_ADJUSTMENT',
        adjustmentReason: 'INVENTORY',
        quantity: 160,
        unit: 'g',
        performedByUserId: 'user-1',
      });

      expect(tx.stockBalance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { currentQuantity: 1.16 } }),
      );
    });
  });

  describe('applyMovement — BR-010 (saldo nunca negativo)', () => {
    it('BLOQUEIA saída que deixaria o saldo negativo', async () => {
      prisma.ingredient.findFirst.mockResolvedValue(ingredient);
      prisma.businessUnit.findFirst.mockResolvedValue(businessUnit);
      mockTransaction({ currentQuantity: '3.0000' }, null, null);

      await expect(
        service.applyMovement({
          organizationId: 'org-1',
          businessUnitId: 'bu-1',
          ingredientId: 'ing-1',
          direction: 'OUT',
          source: 'MANUAL_ADJUSTMENT',
          adjustmentReason: 'LOSS',
          quantity: 5, // saldo atual é 3, saída de 5 -> -2 (bloqueado)
          unit: 'kg',
          performedByUserId: 'user-1',
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('PERMITE saída que deixa o saldo em exatamente zero', async () => {
      prisma.ingredient.findFirst.mockResolvedValue(ingredient);
      prisma.businessUnit.findFirst.mockResolvedValue(businessUnit);
      mockTransaction({ currentQuantity: '5.0000' }, { id: 'mov-1' }, { currentQuantity: 0 });

      const result = await service.applyMovement({
        organizationId: 'org-1',
        businessUnitId: 'bu-1',
        ingredientId: 'ing-1',
        direction: 'OUT',
        source: 'MANUAL_ADJUSTMENT',
        adjustmentReason: 'WASTE',
        quantity: 5,
        unit: 'kg',
        performedByUserId: 'user-1',
      });

      expect(result.balance.currentQuantity).toBe(0);
    });
  });

  describe('applyMovement — validações', () => {
    it('lança NotFoundException quando o ingrediente não existe na organização', async () => {
      prisma.ingredient.findFirst.mockResolvedValue(null);

      await expect(
        service.applyMovement({
          organizationId: 'org-1',
          businessUnitId: 'bu-1',
          ingredientId: 'ing-x',
          direction: 'IN',
          source: 'MANUAL_ADJUSTMENT',
          adjustmentReason: 'CORRECTION',
          quantity: 1,
          unit: 'kg',
          performedByUserId: 'user-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança NotFoundException quando a unidade de negócio não existe na organização', async () => {
      prisma.ingredient.findFirst.mockResolvedValue(ingredient);
      prisma.businessUnit.findFirst.mockResolvedValue(null);

      await expect(
        service.applyMovement({
          organizationId: 'org-1',
          businessUnitId: 'bu-x',
          ingredientId: 'ing-1',
          direction: 'IN',
          source: 'MANUAL_ADJUSTMENT',
          adjustmentReason: 'CORRECTION',
          quantity: 1,
          unit: 'kg',
          performedByUserId: 'user-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listBelowMinimum — RF-018/BR-011 (detecção, sem entrega de alerta)', () => {
    it('retorna apenas ingredientes com saldo abaixo do mínimo configurado', async () => {
      prisma.businessUnit.findFirst.mockResolvedValue(businessUnit);
      prisma.stockBalance.findMany.mockResolvedValue([
        { currentQuantity: '5.0000', ingredient: { minimumStock: '10.0000' } }, // abaixo
        { currentQuantity: '20.0000', ingredient: { minimumStock: '10.0000' } }, // acima
        { currentQuantity: '2.0000', ingredient: { minimumStock: null } }, // sem mínimo configurado
      ]);

      const result = await service.listBelowMinimum('bu-1', 'org-1');

      expect(result).toHaveLength(1);
      expect(result[0].currentQuantity).toBe('5.0000');
    });
  });

  describe('getConsumptionSummary — RF-026 (Etapa 15)', () => {
    it('agrupa e soma saídas por ingrediente no período', async () => {
      prisma.businessUnit.findFirst.mockResolvedValue(businessUnit);
      prisma.stockMovement.findMany.mockResolvedValue([
        { ingredientId: 'ing-1', quantityStandardUnit: '2.0000', ingredient: { name: 'Carne' } },
        { ingredientId: 'ing-1', quantityStandardUnit: '1.5000', ingredient: { name: 'Carne' } },
        { ingredientId: 'ing-2', quantityStandardUnit: '0.5000', ingredient: { name: 'Queijo' } },
      ]);

      const result = await service.getConsumptionSummary(
        'bu-1',
        'org-1',
        new Date('2026-08-01'),
        new Date('2026-08-31'),
      );

      expect(result).toEqual([
        { ingredientId: 'ing-1', ingredientName: 'Carne', totalConsumed: 3.5 },
        { ingredientId: 'ing-2', ingredientName: 'Queijo', totalConsumed: 0.5 },
      ]);
    });

    it('retorna lista vazia quando não há saídas no período', async () => {
      prisma.businessUnit.findFirst.mockResolvedValue(businessUnit);
      prisma.stockMovement.findMany.mockResolvedValue([]);

      const result = await service.getConsumptionSummary(
        'bu-1',
        'org-1',
        new Date('2026-08-01'),
        new Date('2026-08-31'),
      );

      expect(result).toEqual([]);
    });
  });
});
