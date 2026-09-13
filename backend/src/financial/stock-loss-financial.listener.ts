import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FinancialService } from './financial.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  STOCK_ADJUSTMENT_REGISTERED_EVENT,
  StockAdjustmentRegisteredEvent,
} from '../stock/events/stock-adjustment-registered.event';

const REASON_LABELS: Record<string, string> = {
  LOSS: 'Perda',
  WASTE: 'Desperdício',
  INVENTORY: 'Inventário',
  CORRECTION: 'Correção',
  RETURN: 'Devolução',
};

/// Reage a `stock.adjustment.registered` (04/09/2026) criando um
/// lançamento automático de perda quando uma SAÍDA manual de estoque
/// acontece — decisão de negócio confirmada com o usuário: o valor de
/// um ingrediente já pago ao fornecedor não pode simplesmente
/// desaparecer do Financeiro quando se dá baixa por perda/correção/
/// desperdício/inventário. Mesmo padrão de desacoplamento por evento já
/// usado para compra/venda (Etapas 12/16) — StockModule não conhece
/// FinancialModule.
///
/// Só SAÍDA gera lançamento (ENTRADA não é compra nem perda). Se o
/// ingrediente não tiver custo médio cadastrado, a perda não pode ser
/// valorada — loga um aviso e não cria lançamento nenhum, mas o ajuste
/// de estoque em si já foi aplicado e não é desfeito por causa disso
/// (mesmo princípio de "não travar a operação por falta de dado
/// financeiro" já usado em PD-001/Vendas).
@Injectable()
export class StockLossFinancialListener {
  private readonly logger = new Logger(StockLossFinancialListener.name);

  constructor(
    private readonly financialService: FinancialService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent(STOCK_ADJUSTMENT_REGISTERED_EVENT)
  async handleStockAdjustment(event: StockAdjustmentRegisteredEvent): Promise<void> {
    if (event.direction !== 'OUT') {
      return;
    }

    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id: event.ingredientId },
    });

    if (!ingredient) {
      this.logger.warn(
        `Ajuste de saída para ingrediente ${event.ingredientId} não gerou lançamento financeiro: ingrediente não encontrado.`,
      );
      return;
    }

    if (ingredient.averageCost === null) {
      this.logger.warn(
        `Ajuste de saída do ingrediente "${ingredient.name}" não gerou lançamento financeiro: ` +
          `custo médio não cadastrado, não é possível valorar a perda.`,
      );
      return;
    }

    const grossAmount = event.quantityStandardUnit * Number(ingredient.averageCost);
    const reasonLabel = REASON_LABELS[event.reason] ?? event.reason;

    await this.financialService.createEntryFromStockLoss({
      organizationId: event.organizationId,
      businessUnitId: event.businessUnitId,
      description: `${reasonLabel} de estoque — ${ingredient.name} (${event.quantityStandardUnit} ${ingredient.standardUnit})`,
      grossAmount,
      createdByUserId: event.performedByUserId,
    });
  }
}
