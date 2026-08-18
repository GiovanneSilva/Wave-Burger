import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FinancialService } from './financial.service';
import {
  PURCHASE_CONFIRMED_EVENT,
  PurchaseConfirmedEvent,
} from '../purchases/events/purchase-confirmed.event';

/**
 * BR-007: "Compra deverá gerar ou estar associada ao lançamento
 * financeiro correspondente." Terceiro listener independente de
 * `purchase.confirmed` (depois de IngredientsPurchaseListener, Etapa 12,
 * e StockPurchaseListener, Etapa 13) — mais uma prova de que o
 * desacoplamento por evento interno funciona sem exigir qualquer
 * alteração em PurchasesModule (claude/CLAUDE.md, Seção 4).
 */
@Injectable()
export class FinancialPurchaseListener {
  constructor(private readonly financialService: FinancialService) {}

  @OnEvent(PURCHASE_CONFIRMED_EVENT)
  async handlePurchaseConfirmed(event: PurchaseConfirmedEvent): Promise<void> {
    await this.financialService.createEntryFromPurchase({
      organizationId: event.organizationId,
      businessUnitId: event.businessUnitId,
      supplierId: event.supplierId,
      purchaseId: event.purchaseId,
      grossAmount: Number(event.totalAmount),
      createdByUserId: event.confirmedByUserId,
    });
  }
}
