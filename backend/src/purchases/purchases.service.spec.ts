import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PurchasesService } from './purchases.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PURCHASE_CONFIRMED_EVENT } from './events/purchase-confirmed.event';

describe('PurchasesService', () => {
  let service: PurchasesService;
  let prisma: any;
  let audit: { record: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  const actor = { id: 'user-1', organizationId: 'org-1' };

  beforeEach(() => {
    prisma = {
      supplier: { findFirst: jest.fn() },
      businessUnit: { findFirst: jest.fn() },
      ingredient: { findMany: jest.fn() },
      purchase: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    eventEmitter = { emit: jest.fn() };
    service = new PurchasesService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe('create', () => {
    it('registra a compra como DRAFT com total calculado corretamente', async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: 'sup-1' });
      prisma.businessUnit.findFirst.mockResolvedValue({ id: 'bu-1' });
      prisma.ingredient.findMany.mockResolvedValue([{ id: 'ing-1' }]);
      prisma.purchase.create.mockResolvedValue({
        id: 'purch-1',
        status: 'DRAFT',
        totalAmount: 150,
        items: [],
      });

      const result = await service.create(
        {
          supplierId: 'sup-1',
          businessUnitId: 'bu-1',
          purchaseDate: '2026-08-17',
          items: [{ ingredientId: 'ing-1', quantity: '5', unit: 'kg', unitPrice: '30' }],
        } as any,
        actor,
      );

      expect(result.status).toBe('DRAFT');
      expect(prisma.purchase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DRAFT',
            totalAmount: 150,
          }),
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entity: 'Purchase' }),
      );
      expect(eventEmitter.emit).not.toHaveBeenCalled(); // registro NAO dispara evento
    });

    it('lança NotFoundException quando o fornecedor não existe na organização', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          {
            supplierId: 'sup-x',
            businessUnitId: 'bu-1',
            purchaseDate: '2026-08-17',
            items: [{ ingredientId: 'ing-1', quantity: '5', unit: 'kg', unitPrice: '30' }],
          } as any,
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('confirm — o contrato de evento é o ponto central desta etapa', () => {
    it('confirma a compra, atualiza status e emite PURCHASE_CONFIRMED_EVENT com o payload completo', async () => {
      prisma.purchase.findFirst.mockResolvedValue({
        id: 'purch-1',
        status: 'DRAFT',
        organizationId: 'org-1',
        businessUnitId: 'bu-1',
        supplierId: 'sup-1',
        totalAmount: 150,
        items: [{ ingredientId: 'ing-1', quantity: 5, unit: 'kg', unitPrice: 30, totalPrice: 150 }],
      });

      const updatedPurchase = {
        id: 'purch-1',
        status: 'CONFIRMED',
        businessUnitId: 'bu-1',
        supplierId: 'sup-1',
        totalAmount: { toString: () => '150.0000' },
        items: [
          {
            ingredientId: 'ing-1',
            quantity: { toString: () => '5.0000' },
            unit: 'kg',
            unitPrice: { toString: () => '30.0000' },
            totalPrice: { toString: () => '150.0000' },
          },
        ],
      };
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const txClient = { purchase: { update: jest.fn().mockResolvedValue(updatedPurchase) } };
        return fn(txClient);
      });

      const result = await service.confirm('purch-1', actor);

      expect(result.status).toBe('CONFIRMED');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CONFIRM', entity: 'Purchase' }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PURCHASE_CONFIRMED_EVENT,
        expect.objectContaining({
          purchaseId: 'purch-1',
          organizationId: 'org-1',
          businessUnitId: 'bu-1',
          items: [
            expect.objectContaining({
              ingredientId: 'ing-1',
              quantity: '5.0000',
              unit: 'kg',
              unitPrice: '30.0000',
              totalPrice: '150.0000',
            }),
          ],
        }),
      );
    });

    it('BLOQUEIA confirmação de compra que não está em DRAFT', async () => {
      prisma.purchase.findFirst.mockResolvedValue({ id: 'purch-1', status: 'CONFIRMED' });

      await expect(service.confirm('purch-1', actor)).rejects.toThrow(UnprocessableEntityException);
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('BLOQUEIA confirmação de compra já cancelada', async () => {
      prisma.purchase.findFirst.mockResolvedValue({ id: 'purch-1', status: 'CANCELLED' });

      await expect(service.confirm('purch-1', actor)).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('cancel', () => {
    it('cancela uma compra DRAFT', async () => {
      prisma.purchase.findFirst.mockResolvedValue({ id: 'purch-1', status: 'DRAFT' });
      prisma.purchase.update.mockResolvedValue({ id: 'purch-1', status: 'CANCELLED' });

      const result = await service.cancel('purch-1', actor);

      expect(result.status).toBe('CANCELLED');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CANCEL', entity: 'Purchase' }),
      );
    });

    it('BLOQUEIA cancelamento de compra já confirmada', async () => {
      prisma.purchase.findFirst.mockResolvedValue({ id: 'purch-1', status: 'CONFIRMED' });

      await expect(service.cancel('purch-1', actor)).rejects.toThrow(UnprocessableEntityException);
    });
  });
});
