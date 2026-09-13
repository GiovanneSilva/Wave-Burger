import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  PURCHASE_CONFIRMED_EVENT,
  PurchaseConfirmedEvent,
} from '../purchases/events/purchase-confirmed.event';
import { convertPricePerUnit, convertQuantity } from '../common/unit-conversion';
import { calculateWeightedAverageCost } from './average-cost-calculator';

/**
 * Reage a `purchase.confirmed` (Etapa 12) sem que PurchasesModule saiba
 * que este listener existe — desacoplamento via evento interno
 * (claude/CLAUDE.md, Seção 4).
 *
 * Atualiza `lastCost`/`lastPurchaseDate` (RF-009 "último custo" = preço
 * da compra mais recente, sem ambiguidade) E, desde 05/09/2026,
 * `averageCost` — PD-002 resolvida a pedido do usuário: custo médio
 * ponderado móvel (`calculateWeightedAverageCost`), usando
 * `item.stockQuantityBeforePurchase` capturado por
 * `PurchasesService.confirm()` antes de qualquer listener rodar (evita
 * depender de ordem de execução entre listeners do mesmo evento).
 */
@Injectable()
export class IngredientsPurchaseListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  @OnEvent(PURCHASE_CONFIRMED_EVENT)
  async handlePurchaseConfirmed(event: PurchaseConfirmedEvent): Promise<void> {
    for (const item of event.items) {
      const ingredient = await this.prisma.ingredient.findUnique({
        where: { id: item.ingredientId },
      });
      if (!ingredient) {
        continue; // defesa em profundidade; não deveria ocorrer (FK garante existência)
      }

      const costPerStandardUnit = convertPricePerUnit(
        Number(item.unitPrice),
        item.unit,
        ingredient.standardUnit,
      );
      const purchaseQuantityStandardUnit = convertQuantity(
        Number(item.quantity),
        item.unit,
        ingredient.standardUnit,
      );

      const newAverageCost = calculateWeightedAverageCost({
        previousQuantity: Number(item.stockQuantityBeforePurchase),
        previousAverageCost:
          ingredient.averageCost !== null ? Number(ingredient.averageCost) : null,
        purchaseQuantity: purchaseQuantityStandardUnit,
        purchaseTotalValue: Number(item.totalPrice),
      });

      const before = ingredient;
      const updated = await this.prisma.ingredient.update({
        where: { id: item.ingredientId },
        data: {
          lastCost: costPerStandardUnit,
          lastPurchaseDate: event.confirmedAt,
          averageCost: newAverageCost,
        },
      });

      await this.auditService.record({
        organizationId: event.organizationId,
        userId: event.confirmedByUserId,
        action: 'UPDATE_COST_FROM_PURCHASE',
        entity: 'Ingredient',
        entityId: item.ingredientId,
        previousValue: {
          lastCost: before.lastCost,
          lastPurchaseDate: before.lastPurchaseDate,
          averageCost: before.averageCost,
        },
        newValue: {
          lastCost: updated.lastCost,
          lastPurchaseDate: updated.lastPurchaseDate,
          averageCost: updated.averageCost,
        },
        metadata: {
          purchaseId: event.purchaseId,
          stockQuantityBeforePurchase: item.stockQuantityBeforePurchase,
          note: 'averageCost calculado por custo médio ponderado móvel (PD-002, resolvida em 05/09/2026).',
        },
      });
    }
  }
}
