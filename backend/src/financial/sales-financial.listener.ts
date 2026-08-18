import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FinancialService } from './financial.service';
import { SALE_REGISTERED_EVENT, SaleRegisteredEvent } from '../sales/events/sale-registered.event';

/**
 * Reage a `sale.registered` (Etapa 16) criando o lançamento
 * RECEIVABLE/VENDAS correspondente — mesmo padrão de desacoplamento por
 * evento interno já usado para `purchase.confirmed` (BR-007, Etapa 14).
 * SalesModule não conhece FinancialModule.
 */
@Injectable()
export class SalesFinancialListener {
  constructor(private readonly financialService: FinancialService) {}

  @OnEvent(SALE_REGISTERED_EVENT)
  async handleSaleRegistered(event: SaleRegisteredEvent): Promise<void> {
    await this.financialService.createEntryFromSale({
      organizationId: event.organizationId,
      businessUnitId: event.businessUnitId,
      saleId: event.saleId,
      netAmount: Number(event.netAmount),
      createdByUserId: event.soldByUserId,
    });
  }
}
