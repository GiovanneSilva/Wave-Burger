import { StockPurchaseListener } from './stock-purchase.listener';
import { StockService } from './stock.service';
import { PurchaseConfirmedEvent } from '../purchases/events/purchase-confirmed.event';

/**
 * BR-006: prova de que a confirmação de compra (Etapa 12) agora gera
 * entrada de estoque de verdade, sem que PurchasesService tenha sido
 * alterado — o evento `purchase.confirmed` já existia; este listener é
 * inteiramente novo e reage a ele.
 */
describe('StockPurchaseListener (BR-006)', () => {
  let listener: StockPurchaseListener;
  let stockService: { applyMovement: jest.Mock };

  beforeEach(() => {
    stockService = { applyMovement: jest.fn().mockResolvedValue({}) };
    listener = new StockPurchaseListener(stockService as unknown as StockService);
  });

  it('aplica uma movimentação de entrada (IN/PURCHASE) para cada item da compra confirmada', async () => {
    const event: PurchaseConfirmedEvent = {
      purchaseId: 'pur-1',
      organizationId: 'org-1',
      businessUnitId: 'bu-1',
      supplierId: 'sup-1',
      confirmedByUserId: 'user-1',
      confirmedAt: new Date('2026-08-17T12:00:00Z'),
      totalAmount: '150.0000',
      items: [
        {
          ingredientId: 'ing-carne',
          quantity: '5',
          unit: 'kg',
          unitPrice: '30',
          totalPrice: '150',
        },
      ],
    };

    await listener.handlePurchaseConfirmed(event);

    expect(stockService.applyMovement).toHaveBeenCalledWith({
      organizationId: 'org-1',
      businessUnitId: 'bu-1',
      ingredientId: 'ing-carne',
      direction: 'IN',
      source: 'PURCHASE',
      quantity: 5,
      unit: 'kg',
      purchaseId: 'pur-1',
      performedByUserId: 'user-1',
    });
  });

  it('processa múltiplos itens da mesma compra, um por um', async () => {
    const event: PurchaseConfirmedEvent = {
      purchaseId: 'pur-1',
      organizationId: 'org-1',
      businessUnitId: 'bu-1',
      supplierId: 'sup-1',
      confirmedByUserId: 'user-1',
      confirmedAt: new Date(),
      totalAmount: '200.00',
      items: [
        {
          ingredientId: 'ing-carne',
          quantity: '5',
          unit: 'kg',
          unitPrice: '30',
          totalPrice: '150',
        },
        {
          ingredientId: 'ing-queijo',
          quantity: '2',
          unit: 'kg',
          unitPrice: '25',
          totalPrice: '50',
        },
      ],
    };

    await listener.handlePurchaseConfirmed(event);

    expect(stockService.applyMovement).toHaveBeenCalledTimes(2);
  });
});
