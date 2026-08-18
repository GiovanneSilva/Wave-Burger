import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { StockService } from './stock.service';
import {
  PURCHASE_CONFIRMED_EVENT,
  PurchaseConfirmedEvent,
} from '../purchases/events/purchase-confirmed.event';

/**
 * BR-006: "Compra confirmada deverá gerar entrada correspondente no
 * estoque." Reage a `purchase.confirmed` (emitido desde a Etapa 12) sem
 * que PurchasesModule saiba que este listener existe — o mesmo
 * desacoplamento via evento interno já documentado em
 * claude/CLAUDE.md, Seção 4.
 *
 * Este é o segundo listener desse evento — o primeiro
 * (IngredientsPurchaseListener, Etapa 12) atualiza lastCost/lastPurchaseDate.
 * Nenhum dos dois precisou alterar PurchasesModule.
 */
@Injectable()
export class StockPurchaseListener {
  constructor(private readonly stockService: StockService) {}

  @OnEvent(PURCHASE_CONFIRMED_EVENT)
  async handlePurchaseConfirmed(event: PurchaseConfirmedEvent): Promise<void> {
    for (const item of event.items) {
      await this.stockService.applyMovement({
        organizationId: event.organizationId,
        businessUnitId: event.businessUnitId,
        ingredientId: item.ingredientId,
        direction: 'IN',
        source: 'PURCHASE',
        quantity: Number(item.quantity),
        unit: item.unit,
        purchaseId: event.purchaseId,
        performedByUserId: event.confirmedByUserId,
      });
    }
  }
}
