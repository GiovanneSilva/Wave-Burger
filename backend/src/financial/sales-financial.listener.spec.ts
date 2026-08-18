import { SalesFinancialListener } from './sales-financial.listener';
import { FinancialService } from './financial.service';
import { SaleRegisteredEvent } from '../sales/events/sale-registered.event';

describe('SalesFinancialListener', () => {
  let listener: SalesFinancialListener;
  let financialService: { createEntryFromSale: jest.Mock };

  beforeEach(() => {
    financialService = { createEntryFromSale: jest.fn().mockResolvedValue({}) };
    listener = new SalesFinancialListener(financialService as unknown as FinancialService);
  });

  it('cria um lançamento RECEIVABLE/VENDAS para a venda registrada', async () => {
    const event: SaleRegisteredEvent = {
      saleId: 'sale-1',
      organizationId: 'org-1',
      businessUnitId: 'bu-1',
      productId: 'prod-1',
      netAmount: '57.8000',
      soldByUserId: 'user-1',
      saleDate: new Date('2026-08-17'),
    };

    await listener.handleSaleRegistered(event);

    expect(financialService.createEntryFromSale).toHaveBeenCalledWith({
      organizationId: 'org-1',
      businessUnitId: 'bu-1',
      saleId: 'sale-1',
      netAmount: 57.8,
      createdByUserId: 'user-1',
    });
  });
});
