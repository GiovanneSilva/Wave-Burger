import { ConflictException, NotFoundException } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('IngredientsService', () => {
  let service: IngredientsService;
  let prisma: {
    ingredient: {
      findFirst: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    purchaseItem: {
      findMany: jest.Mock;
    };
  };
  let audit: { record: jest.Mock };

  const actor = { id: 'user-1', organizationId: 'org-1' };

  beforeEach(() => {
    prisma = {
      ingredient: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      purchaseItem: {
        findMany: jest.fn(),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new IngredientsService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  describe('create', () => {
    it('cria um ingrediente e registra auditoria', async () => {
      prisma.ingredient.findFirst.mockResolvedValue(null);
      const created = { id: 'ing-1', name: 'Carne Bovina', organizationId: 'org-1' };
      prisma.ingredient.create.mockResolvedValue(created);

      const result = await service.create(
        { name: 'Carne Bovina', standardUnit: 'kg' } as any,
        actor,
      );

      expect(result).toEqual(created);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          entity: 'Ingredient',
          entityId: 'ing-1',
          organizationId: 'org-1',
          userId: 'user-1',
        }),
      );
    });

    it('REJEITA nome duplicado na mesma organização (fonte única da verdade)', async () => {
      prisma.ingredient.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({ name: 'Carne Bovina', standardUnit: 'kg' } as any, actor),
      ).rejects.toThrow(ConflictException);
      expect(prisma.ingredient.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('lança NotFoundException quando o ingrediente não existe na organização', async () => {
      prisma.ingredient.findFirst.mockResolvedValue(null);

      await expect(service.findById('ing-x', 'org-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('registra auditoria com nota sobre BR-004 quando o custo muda', async () => {
      const before = {
        id: 'ing-1',
        name: 'Carne Bovina',
        averageCost: { toString: () => '30.0000' },
        lastCost: { toString: () => '30.0000' },
      };
      prisma.ingredient.findFirst.mockResolvedValue(before);
      const updated = { ...before, averageCost: '32.0000' };
      prisma.ingredient.update.mockResolvedValue(updated);

      await service.update('ing-1', { averageCost: '32.0000' } as any, actor);

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          metadata: expect.objectContaining({ note: expect.stringContaining('BR-004') }),
        }),
      );
    });

    it('não inclui nota de recálculo quando o custo não muda', async () => {
      const before = {
        id: 'ing-1',
        name: 'Carne Bovina',
        averageCost: { toString: () => '30.0000' },
        lastCost: { toString: () => '30.0000' },
      };
      prisma.ingredient.findFirst.mockResolvedValue(before);
      prisma.ingredient.update.mockResolvedValue({ ...before, storageLocation: 'Câmara fria' });

      await service.update('ing-1', { storageLocation: 'Câmara fria' } as any, actor);

      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ metadata: undefined }));
    });
  });

  describe('deactivate / activate', () => {
    it('inativa (nunca exclui fisicamente) e registra auditoria', async () => {
      prisma.ingredient.findFirst.mockResolvedValue({ id: 'ing-1', isActive: true });
      prisma.ingredient.update.mockResolvedValue({ id: 'ing-1', isActive: false });

      const result = await service.deactivate('ing-1', actor);

      expect(result.isActive).toBe(false);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEACTIVATE', entity: 'Ingredient' }),
      );
    });
  });

  describe('recalculateAverageCostFromLastPurchases (05/09/2026, PD-002)', () => {
    const ingredient = { id: 'ing-1', standardUnit: 'kg', averageCost: null, isActive: true };

    it('EXEMPLO COMPLETO: pondera a penúltima e a última compra confirmada', async () => {
      // Penúltima compra: 2kg a R$28/kg (valor R$56)
      // Última compra:    5kg a R$30/kg (valor R$150)
      // Novo custo médio = (56 + 150) / (2 + 5) = 206/7 ≈ 29,4286
      prisma.ingredient.findFirst.mockResolvedValue(ingredient);
      prisma.purchaseItem.findMany.mockResolvedValue([
        {
          quantity: '5',
          unit: 'kg',
          totalPrice: '150',
          purchase: { confirmedAt: new Date('2026-09-02') },
        },
        {
          quantity: '2',
          unit: 'kg',
          totalPrice: '56',
          purchase: { confirmedAt: new Date('2026-08-20') },
        },
      ]);
      prisma.ingredient.update.mockResolvedValue({ ...ingredient, averageCost: '29.4286' });

      await service.recalculateAverageCostFromLastPurchases('ing-1', actor);

      const updateCall = prisma.ingredient.update.mock.calls[0][0];
      expect(updateCall.data.averageCost).toBeCloseTo(29.4286, 4);
    });

    it('só uma compra no histórico — usa o preço dela diretamente, sem ponderar', async () => {
      prisma.ingredient.findFirst.mockResolvedValue(ingredient);
      prisma.purchaseItem.findMany.mockResolvedValue([
        {
          quantity: '3',
          unit: 'kg',
          totalPrice: '90',
          purchase: { confirmedAt: new Date('2026-09-01') },
        },
      ]);
      prisma.ingredient.update.mockResolvedValue({ ...ingredient, averageCost: '30' });

      await service.recalculateAverageCostFromLastPurchases('ing-1', actor);

      const updateCall = prisma.ingredient.update.mock.calls[0][0];
      expect(updateCall.data.averageCost).toBe(30); // 90/3
    });

    it('REJEITA quando não há nenhuma compra confirmada no histórico', async () => {
      prisma.ingredient.findFirst.mockResolvedValue(ingredient);
      prisma.purchaseItem.findMany.mockResolvedValue([]);

      await expect(service.recalculateAverageCostFromLastPurchases('ing-1', actor)).rejects.toThrow(
        'Nenhuma compra confirmada encontrada',
      );
      expect(prisma.ingredient.update).not.toHaveBeenCalled();
    });

    it('converte unidades diferentes entre as duas compras antes de ponderar (kg vs g)', async () => {
      // Penúltima: 500g a R$0,03/g (valor R$15) = equivalente a 0,5kg
      // Última:    2kg a R$32/kg (valor R$64)
      // Novo custo médio = (15 + 64) / (0.5 + 2) = 79/2.5 = R$31,60/kg
      prisma.ingredient.findFirst.mockResolvedValue(ingredient);
      prisma.purchaseItem.findMany.mockResolvedValue([
        {
          quantity: '2',
          unit: 'kg',
          totalPrice: '64',
          purchase: { confirmedAt: new Date('2026-09-02') },
        },
        {
          quantity: '500',
          unit: 'g',
          totalPrice: '15',
          purchase: { confirmedAt: new Date('2026-08-20') },
        },
      ]);
      prisma.ingredient.update.mockResolvedValue({ ...ingredient, averageCost: '31.6' });

      await service.recalculateAverageCostFromLastPurchases('ing-1', actor);

      const updateCall = prisma.ingredient.update.mock.calls[0][0];
      expect(updateCall.data.averageCost).toBeCloseTo(31.6, 4);
    });

    it('registra auditoria com o número de compras usadas no cálculo', async () => {
      prisma.ingredient.findFirst.mockResolvedValue(ingredient);
      prisma.purchaseItem.findMany.mockResolvedValue([
        { quantity: '5', unit: 'kg', totalPrice: '150', purchase: { confirmedAt: new Date() } },
        { quantity: '2', unit: 'kg', totalPrice: '56', purchase: { confirmedAt: new Date() } },
      ]);
      prisma.ingredient.update.mockResolvedValue({ ...ingredient, averageCost: '29.4286' });

      await service.recalculateAverageCostFromLastPurchases('ing-1', actor);

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RECALCULATE_AVERAGE_COST',
          entity: 'Ingredient',
          metadata: expect.objectContaining({ basedOnPurchaseCount: 2 }),
        }),
      );
    });
  });
});
