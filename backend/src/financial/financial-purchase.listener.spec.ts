import { FinancialPurchaseListener } from './financial-purchase.listener';
import { FinancialService } from './financial.service';
import { PurchaseConfirmedEvent } from '../purchases/events/purchase-confirmed.event';

/**
 * BR-007: prova de que a confirmação de compra (Etapa 12) agora gera o
 * lançamento financeiro correspondente, sem qualquer alteração em
 * PurchasesService — terceiro listener independente do mesmo evento.
 */
describe('FinancialPurchaseListener (BR-007)', () => {
  let listener: FinancialPurchaseListener;
  let financialService: { createEntryFromPurchase: jest.Mock };

  beforeEach(() => {
    financialService = { createEntryFromPurchase: jest.fn().mockResolvedValue({}) };
    listener = new FinancialPurchaseListener(financialService as unknown as FinancialService);
  });

  it('cria um lançamento financeiro para a compra confirmada', async () => {
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

    expect(financialService.createEntryFromPurchase).toHaveBeenCalledWith({
      organizationId: 'org-1',
      businessUnitId: 'bu-1',
      supplierId: 'sup-1',
      purchaseId: 'pur-1',
      grossAmount: 150,
      createdByUserId: 'user-1',
    });
  });
});
