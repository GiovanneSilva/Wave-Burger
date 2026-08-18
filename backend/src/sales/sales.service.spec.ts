import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SalesService } from './sales.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FichaTecnicaService } from '../ficha-tecnica/ficha-tecnica.service';
import { StockService } from '../stock/stock.service';
import { SALE_REGISTERED_EVENT } from './events/sale-registered.event';

describe('SalesService', () => {
  let service: SalesService;
  let prisma: any;
  let audit: { record: jest.Mock };
  let fichaTecnicaService: { findCurrentByProduct: jest.Mock };
  let stockService: { applyMovementInTransaction: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  const actor = { id: 'user-1', organizationId: 'org-1' };
  const activeProduct = { id: 'prod-1', status: 'ACTIVE', salePrice: '28.90' };
  const fichaComUmItem = {
    items: [{ ingredientId: 'ing-carne', quantity: '0.16', unit: 'kg' }],
  };

  beforeEach(() => {
    prisma = {
      product: { findFirst: jest.fn() },
      sale: { create: jest.fn(), update: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    fichaTecnicaService = { findCurrentByProduct: jest.fn() };
    stockService = { applyMovementInTransaction: jest.fn() };
    eventEmitter = { emit: jest.fn() };

    service = new SalesService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      fichaTecnicaService as unknown as FichaTecnicaService,
      stockService as unknown as StockService,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  function mockTransaction(saleCreated: any) {
    const txClient = {
      sale: {
        create: jest.fn().mockResolvedValue(saleCreated),
        update: jest.fn().mockResolvedValue({ ...saleCreated, hadInsufficientStock: true }),
      },
    };
    prisma.$transaction.mockImplementation(async (fn: any) => fn(txClient));
    return txClient;
  }

  describe('registerSale — fluxo básico', () => {
    it('registra a venda, consome estoque via ficha técnica e emite sale.registered', async () => {
      prisma.product.findFirst.mockResolvedValue(activeProduct);
      fichaTecnicaService.findCurrentByProduct.mockResolvedValue(fichaComUmItem);
      stockService.applyMovementInTransaction.mockResolvedValue({
        wentNegative: false,
        balance: { currentQuantity: 5 },
        ingredientName: 'Carne Bovina',
      });
      const saleCreated = {
        id: 'sale-1',
        netAmount: { toString: () => '57.8000' },
        saleDate: new Date('2026-08-17'),
      };
      mockTransaction(saleCreated);

      const result = await service.registerSale(
        { businessUnitId: 'bu-1', productId: 'prod-1', quantity: '2' } as any,
        actor,
      );

      expect(result.id).toBe('sale-1');
      expect(result.stockWarnings).toEqual([]);
      expect(stockService.applyMovementInTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          ingredientId: 'ing-carne',
          direction: 'OUT',
          source: 'SALE',
          quantity: 0.32, // 0.16 (ficha) * 2 (quantidade vendida)
          unit: 'kg',
          allowNegative: true, // PD-001
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        SALE_REGISTERED_EVENT,
        expect.objectContaining({ saleId: 'sale-1' }),
      );
    });

    it('REJEITA venda de produto não ativo (BR-001)', async () => {
      prisma.product.findFirst.mockResolvedValue({ ...activeProduct, status: 'DRAFT' });

      await expect(
        service.registerSale({ businessUnitId: 'bu-1', productId: 'prod-1', quantity: '1' } as any, actor),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('lança NotFoundException quando o produto não existe', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(
        service.registerSale({ businessUnitId: 'bu-1', productId: 'prod-x', quantity: '1' } as any, actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('usa o preço informado no DTO em vez do preço do produto, quando fornecido', async () => {
      prisma.product.findFirst.mockResolvedValue(activeProduct);
      fichaTecnicaService.findCurrentByProduct.mockResolvedValue(fichaComUmItem);
      stockService.applyMovementInTransaction.mockResolvedValue({
        wentNegative: false,
        balance: { currentQuantity: 5 },
        ingredientName: 'Carne Bovina',
      });
      const saleCreated = { id: 'sale-1', netAmount: { toString: () => '50.0000' }, saleDate: new Date() };
      const tx = mockTransaction(saleCreated);

      await service.registerSale(
        { businessUnitId: 'bu-1', productId: 'prod-1', quantity: '1', unitPrice: '25.00' } as any,
        actor,
      );

      expect(tx.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ unitPriceSnapshot: 25 }) }),
      );
    });
  });

  describe('registerSale — PD-001 (sinaliza, NUNCA bloqueia)', () => {
    it('registra a venda normalmente mesmo quando o consumo deixa saldo negativo, e sinaliza no retorno', async () => {
      prisma.product.findFirst.mockResolvedValue(activeProduct);
      fichaTecnicaService.findCurrentByProduct.mockResolvedValue(fichaComUmItem);
      stockService.applyMovementInTransaction.mockResolvedValue({
        wentNegative: true,
        balance: { currentQuantity: -0.16 },
        ingredientName: 'Carne Bovina',
      });
      const saleCreated = {
        id: 'sale-1',
        netAmount: { toString: () => '28.9000' },
        saleDate: new Date(),
      };
      const tx = mockTransaction(saleCreated);

      const result = await service.registerSale(
        { businessUnitId: 'bu-1', productId: 'prod-1', quantity: '1' } as any,
        actor,
      );

      // a venda foi registrada (não lançou exceção) e o sinal está no retorno
      expect(result.stockWarnings).toHaveLength(1);
      expect(result.stockWarnings[0]).toEqual(
        expect.objectContaining({ ingredientId: 'ing-carne', ingredientName: 'Carne Bovina' }),
      );
      // hadInsufficientStock foi persistido via update dentro da mesma transação
      expect(tx.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { hadInsufficientStock: true } }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.objectContaining({ stockWarnings: expect.any(Array) }) }),
      );
    });
  });

  describe('desconto (Etapa 16, escopo confirmado)', () => {
    it('calcula desconto percentual corretamente', async () => {
      prisma.product.findFirst.mockResolvedValue(activeProduct);
      fichaTecnicaService.findCurrentByProduct.mockResolvedValue(fichaComUmItem);
      stockService.applyMovementInTransaction.mockResolvedValue({
        wentNegative: false,
        balance: { currentQuantity: 5 },
        ingredientName: 'Carne Bovina',
      });
      const saleCreated = { id: 'sale-1', netAmount: { toString: () => '26.01' }, saleDate: new Date() };
      const tx = mockTransaction(saleCreated);

      await service.registerSale(
        {
          businessUnitId: 'bu-1',
          productId: 'prod-1',
          quantity: '1',
          discountType: 'PERCENTAGE',
          discountValue: '10',
        } as any,
        actor,
      );

      // grossAmount=28.90, desconto 10% = 2.89, net = 26.01
      expect(tx.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ discountAmount: 2.89, netAmount: 26.01 }),
        }),
      );
    });

    it('calcula desconto fixo corretamente', async () => {
      prisma.product.findFirst.mockResolvedValue(activeProduct);
      fichaTecnicaService.findCurrentByProduct.mockResolvedValue(fichaComUmItem);
      stockService.applyMovementInTransaction.mockResolvedValue({
        wentNegative: false,
        balance: { currentQuantity: 5 },
        ingredientName: 'Carne Bovina',
      });
      const saleCreated = { id: 'sale-1', netAmount: { toString: () => '23.90' }, saleDate: new Date() };
      const tx = mockTransaction(saleCreated);

      await service.registerSale(
        {
          businessUnitId: 'bu-1',
          productId: 'prod-1',
          quantity: '1',
          discountType: 'FIXED',
          discountValue: '5',
        } as any,
        actor,
      );

      expect(tx.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ discountAmount: 5, netAmount: 23.9 }) }),
      );
    });

    it('REJEITA desconto maior que o valor bruto da venda', async () => {
      prisma.product.findFirst.mockResolvedValue(activeProduct);

      await expect(
        service.registerSale(
          {
            businessUnitId: 'bu-1',
            productId: 'prod-1',
            quantity: '1',
            discountType: 'FIXED',
            discountValue: '100',
          } as any,
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
