import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  PURCHASE_CONFIRMED_EVENT,
  PurchaseConfirmedEvent,
} from '../purchases/events/purchase-confirmed.event';
import { convertPricePerUnit } from '../common/unit-conversion';

/**
 * Reage a `purchase.confirmed` (Etapa 12) sem que PurchasesModule saiba
 * que este listener existe — desacoplamento via evento interno
 * (claude/CLAUDE.md, Seção 4).
 *
 * Atualiza APENAS `lastCost`/`lastPurchaseDate` do ingrediente — dado
 * objetivo e sem ambiguidade (RF-009 "último custo" = preço da compra
 * mais recente). NUNCA atualiza `averageCost`: a metodologia de custo
 * médio é PD-002, que segue sem definição no Documento Mestre. BR-008
 * ("compras deverão atualizar o custo médio") permanece parcialmente
 * não implementado por esse motivo — decisão registrada em claude/CLAUDE.md.
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

      const before = ingredient;
      const updated = await this.prisma.ingredient.update({
        where: { id: item.ingredientId },
        data: {
          lastCost: costPerStandardUnit,
          lastPurchaseDate: event.confirmedAt,
        },
      });

      await this.auditService.record({
        organizationId: event.organizationId,
        userId: event.confirmedByUserId,
        action: 'UPDATE_LAST_COST_FROM_PURCHASE',
        entity: 'Ingredient',
        entityId: item.ingredientId,
        previousValue: { lastCost: before.lastCost, lastPurchaseDate: before.lastPurchaseDate },
        newValue: { lastCost: updated.lastCost, lastPurchaseDate: updated.lastPurchaseDate },
        metadata: {
          purchaseId: event.purchaseId,
          note: 'averageCost não foi alterado — metodologia de custo médio depende de PD-002, ainda em aberto.',
        },
      });
    }
  }
}
