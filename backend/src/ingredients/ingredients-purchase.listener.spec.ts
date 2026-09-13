import { IngredientsPurchaseListener } from './ingredients-purchase.listener';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PurchaseConfirmedEvent } from '../purchases/events/purchase-confirmed.event';

describe('IngredientsPurchaseListener — reage a purchase.confirmed sem acoplamento direto', () => {
  let listener: IngredientsPurchaseListener;
  let prisma: any;
  let audit: { record: jest.Mock };

  beforeEach(() => {
    prisma = {
      ingredient: { findUnique: jest.fn(), update: jest.fn() },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    listener = new IngredientsPurchaseListener(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  function buildEvent(overrides: Partial<PurchaseConfirmedEvent> = {}): PurchaseConfirmedEvent {
    return {
      purchaseId: 'purch-1',
      organizationId: 'org-1',
      businessUnitId: 'bu-1',
      supplierId: 'sup-1',
      confirmedByUserId: 'user-1',
      confirmedAt: new Date('2026-08-17T12:00:00Z'),
      totalAmount: '150.0000',
      items: [
        {
          ingredientId: 'ing-1',
          quantity: '5.0000',
          unit: 'kg',
          unitPrice: '30.0000',
          totalPrice: '150.0000',
          stockQuantityBeforePurchase: '0',
        },
      ],
      ...overrides,
    };
  }

  it('atualiza lastCost e lastPurchaseDate quando o preço bate na unidade padrão do ingrediente', async () => {
    prisma.ingredient.findUnique.mockResolvedValue({
      id: 'ing-1',
      standardUnit: 'kg',
      lastCost: null,
      lastPurchaseDate: null,
      averageCost: null,
    });
    prisma.ingredient.update.mockResolvedValue({
      id: 'ing-1',
      lastCost: '30.0000',
      lastPurchaseDate: new Date('2026-08-17T12:00:00Z'),
    });

    await listener.handlePurchaseConfirmed(buildEvent());

    const updateCall = prisma.ingredient.update.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: 'ing-1' });
    expect(updateCall.data.lastCost).toBe(30);
    expect(updateCall.data.lastPurchaseDate).toEqual(new Date('2026-08-17T12:00:00Z'));
  });

  describe('PD-002 (05/09/2026, resolvida) — custo médio ponderado móvel', () => {
    it('EXEMPLO COMPLETO: pondera o custo médio existente pela quantidade que já estava em estoque', async () => {
      // 2kg em estoque a R$28/kg (valor: R$56) + compra de 5kg a R$30/kg (valor: R$150)
      // novo custo médio = (56 + 150) / (2 + 5) = 206/7 ≈ 29,4286
      prisma.ingredient.findUnique.mockResolvedValue({
        id: 'ing-1',
        standardUnit: 'kg',
        lastCost: null,
        lastPurchaseDate: null,
        averageCost: '28.0000',
      });
      prisma.ingredient.update.mockResolvedValue({});

      await listener.handlePurchaseConfirmed(
        buildEvent({
          items: [
            {
              ingredientId: 'ing-1',
              quantity: '5',
              unit: 'kg',
              unitPrice: '30',
              totalPrice: '150',
              stockQuantityBeforePurchase: '2',
            },
          ],
        }),
      );

      const updateCall = prisma.ingredient.update.mock.calls[0][0];
      expect(updateCall.data.averageCost).toBeCloseTo(29.4286, 4);
    });

    it('primeira compra de todas (sem custo médio prévio, estoque zerado) — custo médio vira o preço desta compra', async () => {
      prisma.ingredient.findUnique.mockResolvedValue({
        id: 'ing-1',
        standardUnit: 'kg',
        lastCost: null,
        lastPurchaseDate: null,
        averageCost: null,
      });
      prisma.ingredient.update.mockResolvedValue({});

      await listener.handlePurchaseConfirmed(buildEvent());

      const updateCall = prisma.ingredient.update.mock.calls[0][0];
      expect(updateCall.data.averageCost).toBe(30);
    });

    it('usa item.stockQuantityBeforePurchase capturado pelo PurchasesService — não depende de reconsultar o saldo', async () => {
      prisma.ingredient.findUnique.mockResolvedValue({
        id: 'ing-1',
        standardUnit: 'kg',
        lastCost: null,
        lastPurchaseDate: null,
        averageCost: '20.0000',
      });
      prisma.ingredient.update.mockResolvedValue({});

      await listener.handlePurchaseConfirmed(
        buildEvent({
          items: [
            {
              ingredientId: 'ing-1',
              quantity: '1',
              unit: 'kg',
              unitPrice: '100',
              totalPrice: '100',
              stockQuantityBeforePurchase: '100', // muito estoque prévio, dilui bastante
            },
          ],
        }),
      );

      const updateCall = prisma.ingredient.update.mock.calls[0][0];
      // (100*20 + 1*100) / 101 ≈ 20,7921
      expect(updateCall.data.averageCost).toBeCloseTo(20.7921, 4);
    });
  });

  it('converte o preço quando a unidade da compra difere da unidade padrão do ingrediente (kg vs g)', async () => {
    prisma.ingredient.findUnique.mockResolvedValue({
      id: 'ing-1',
      standardUnit: 'kg',
      lastCost: null,
      lastPurchaseDate: null,
      averageCost: null,
    });
    prisma.ingredient.update.mockResolvedValue({});

    // Compra em gramas: R$0,03/g -> deve virar R$30/kg no lastCost
    await listener.handlePurchaseConfirmed(
      buildEvent({
        items: [
          {
            ingredientId: 'ing-1',
            quantity: '5000',
            unit: 'g',
            unitPrice: '0.03',
            totalPrice: '150',
            stockQuantityBeforePurchase: '0',
          },
        ],
      }),
    );

    const updateCall = prisma.ingredient.update.mock.calls[0][0];
    expect(updateCall.data.lastCost).toBeCloseTo(30, 4);
  });

  it('registra auditoria mencionando o custo médio ponderado móvel', async () => {
    prisma.ingredient.findUnique.mockResolvedValue({
      id: 'ing-1',
      standardUnit: 'kg',
      lastCost: null,
      lastPurchaseDate: null,
      averageCost: null,
    });
    prisma.ingredient.update.mockResolvedValue({
      lastCost: '30.0000',
      lastPurchaseDate: new Date(),
      averageCost: '30.0000',
    });

    await listener.handlePurchaseConfirmed(buildEvent());

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_COST_FROM_PURCHASE',
        entity: 'Ingredient',
        metadata: expect.objectContaining({ note: expect.stringContaining('PD-002') }),
      }),
    );
  });

  it('processa múltiplos itens de uma mesma compra, um ingrediente por vez', async () => {
    prisma.ingredient.findUnique
      .mockResolvedValueOnce({ id: 'ing-1', standardUnit: 'kg', averageCost: null })
      .mockResolvedValueOnce({ id: 'ing-2', standardUnit: 'l', averageCost: null });
    prisma.ingredient.update.mockResolvedValue({});

    await listener.handlePurchaseConfirmed(
      buildEvent({
        items: [
          {
            ingredientId: 'ing-1',
            quantity: '5',
            unit: 'kg',
            unitPrice: '30',
            totalPrice: '150',
            stockQuantityBeforePurchase: '0',
          },
          {
            ingredientId: 'ing-2',
            quantity: '10',
            unit: 'l',
            unitPrice: '5',
            totalPrice: '50',
            stockQuantityBeforePurchase: '0',
          },
        ],
      }),
    );

    expect(prisma.ingredient.update).toHaveBeenCalledTimes(2);
  });
});
