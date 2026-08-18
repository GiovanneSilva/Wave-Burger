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
      averageCost: '25.0000', // custo médio existente ANTES do evento
    });
    prisma.ingredient.update.mockResolvedValue({
      id: 'ing-1',
      lastCost: '30.0000',
      lastPurchaseDate: new Date('2026-08-17T12:00:00Z'),
    });

    await listener.handlePurchaseConfirmed(buildEvent());

    expect(prisma.ingredient.update).toHaveBeenCalledWith({
      where: { id: 'ing-1' },
      data: { lastCost: 30, lastPurchaseDate: new Date('2026-08-17T12:00:00Z') },
    });
  });

  it('NUNCA inclui averageCost no update — PD-002 permanece sem definição', async () => {
    prisma.ingredient.findUnique.mockResolvedValue({
      id: 'ing-1',
      standardUnit: 'kg',
      lastCost: null,
      lastPurchaseDate: null,
      averageCost: '25.0000',
    });
    prisma.ingredient.update.mockResolvedValue({});

    await listener.handlePurchaseConfirmed(buildEvent());

    const updateCall = prisma.ingredient.update.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('averageCost');
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
          },
        ],
      }),
    );

    const updateCall = prisma.ingredient.update.mock.calls[0][0];
    expect(updateCall.data.lastCost).toBeCloseTo(30, 4);
  });

  it('registra auditoria com nota explícita sobre PD-002', async () => {
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
    });

    await listener.handlePurchaseConfirmed(buildEvent());

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_LAST_COST_FROM_PURCHASE',
        entity: 'Ingredient',
        metadata: expect.objectContaining({ note: expect.stringContaining('PD-002') }),
      }),
    );
  });

  it('processa múltiplos itens de uma mesma compra, um ingrediente por vez', async () => {
    prisma.ingredient.findUnique
      .mockResolvedValueOnce({ id: 'ing-1', standardUnit: 'kg' })
      .mockResolvedValueOnce({ id: 'ing-2', standardUnit: 'l' });
    prisma.ingredient.update.mockResolvedValue({});

    await listener.handlePurchaseConfirmed(
      buildEvent({
        items: [
          { ingredientId: 'ing-1', quantity: '5', unit: 'kg', unitPrice: '30', totalPrice: '150' },
          { ingredientId: 'ing-2', quantity: '10', unit: 'l', unitPrice: '5', totalPrice: '50' },
        ],
      }),
    );

    expect(prisma.ingredient.update).toHaveBeenCalledTimes(2);
  });
});
