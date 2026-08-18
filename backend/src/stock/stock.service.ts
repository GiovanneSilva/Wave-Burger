import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { convertQuantity } from '../common/unit-conversion';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';

interface ActingUser {
  id: string;
  organizationId: string;
}

export interface ApplyMovementInput {
  organizationId: string;
  businessUnitId: string;
  ingredientId: string;
  direction: 'IN' | 'OUT';
  source: 'PURCHASE' | 'MANUAL_ADJUSTMENT';
  quantity: number;
  unit: string;
  adjustmentReason?: 'LOSS' | 'WASTE' | 'INVENTORY' | 'CORRECTION' | 'RETURN';
  purchaseId?: string;
  performedByUserId: string;
  notes?: string;
}

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /// Núcleo do módulo: aplica uma movimentação de estoque (entrada ou
  /// saída) de forma transacional — cria o registro histórico
  /// (StockMovement, append-only) e atualiza o saldo (StockBalance) numa
  /// única transação. BR-010: nunca permite saldo resultante negativo.
  ///
  /// Chamado tanto pelo endpoint de ajuste manual (RF-017) quanto pelo
  /// StockPurchaseListener (BR-006, reagindo a `purchase.confirmed`).
  async applyMovement(input: ApplyMovementInput) {
    const ingredient = await this.prisma.ingredient.findFirst({
      where: { id: input.ingredientId, organizationId: input.organizationId },
    });
    if (!ingredient) {
      throw new NotFoundException('Ingrediente não encontrado.');
    }

    const businessUnit = await this.prisma.businessUnit.findFirst({
      where: { id: input.businessUnitId, organizationId: input.organizationId },
    });
    if (!businessUnit) {
      throw new NotFoundException('Unidade de negócio não encontrada.');
    }

    const quantityStandardUnit = convertQuantity(
      input.quantity,
      input.unit,
      ingredient.standardUnit,
    );
    const signedDelta = input.direction === 'IN' ? quantityStandardUnit : -quantityStandardUnit;

    const result = await this.prisma.$transaction(async (tx: typeof this.prisma) => {
      const existingBalance = await tx.stockBalance.findUnique({
        where: {
          businessUnitId_ingredientId: {
            businessUnitId: input.businessUnitId,
            ingredientId: input.ingredientId,
          },
        },
      });

      const currentQuantity = existingBalance ? Number(existingBalance.currentQuantity) : 0;
      const newQuantity = round4(currentQuantity + signedDelta);

      // BR-010: o sistema não deve permitir saldo negativo. A ressalva de
      // PD-001 (venda sem estoque) é específica do módulo de Vendas
      // (Etapa 16, ainda não implementado) e não se aplica aqui.
      if (newQuantity < 0) {
        throw new UnprocessableEntityException(
          `Movimentação rejeitada (BR-010): saldo resultante seria negativo (${newQuantity} ${ingredient.standardUnit}). ` +
            `Saldo atual: ${currentQuantity} ${ingredient.standardUnit}.`,
        );
      }

      const movement = await tx.stockMovement.create({
        data: {
          businessUnitId: input.businessUnitId,
          ingredientId: input.ingredientId,
          direction: input.direction,
          source: input.source,
          adjustmentReason: input.adjustmentReason,
          quantity: input.quantity,
          unit: input.unit,
          quantityStandardUnit,
          purchaseId: input.purchaseId,
          performedByUserId: input.performedByUserId,
          notes: input.notes,
        },
      });

      const balance = await tx.stockBalance.upsert({
        where: {
          businessUnitId_ingredientId: {
            businessUnitId: input.businessUnitId,
            ingredientId: input.ingredientId,
          },
        },
        update: { currentQuantity: newQuantity },
        create: {
          businessUnitId: input.businessUnitId,
          ingredientId: input.ingredientId,
          currentQuantity: newQuantity,
        },
      });

      return { movement, balance };
    });

    await this.auditService.record({
      organizationId: input.organizationId,
      userId: input.performedByUserId,
      action: input.direction === 'IN' ? 'STOCK_ENTRY' : 'STOCK_EXIT',
      entity: 'StockMovement',
      entityId: result.movement.id,
      newValue: result.movement,
      metadata: {
        ingredientId: input.ingredientId,
        businessUnitId: input.businessUnitId,
        resultingBalance: result.balance.currentQuantity,
      },
    });

    return result;
  }

  /// RF-017: endpoint de ajuste manual — usuário informa motivo
  /// obrigatório (LOSS/WASTE/INVENTORY/CORRECTION/RETURN).
  async createManualAdjustment(dto: CreateStockAdjustmentDto, actor: ActingUser) {
    return this.applyMovement({
      organizationId: actor.organizationId,
      businessUnitId: dto.businessUnitId,
      ingredientId: dto.ingredientId,
      direction: dto.direction,
      source: 'MANUAL_ADJUSTMENT',
      quantity: Number(dto.quantity),
      unit: dto.unit,
      adjustmentReason: dto.reason,
      performedByUserId: actor.id,
      notes: dto.notes,
    });
  }

  async getBalance(businessUnitId: string, ingredientId: string, organizationId: string) {
    await this.ensureBusinessUnitBelongsToOrg(businessUnitId, organizationId);

    const balance = await this.prisma.stockBalance.findUnique({
      where: { businessUnitId_ingredientId: { businessUnitId, ingredientId } },
      include: { ingredient: true },
    });

    return (
      balance ?? {
        businessUnitId,
        ingredientId,
        currentQuantity: 0,
      }
    );
  }

  async listBalances(businessUnitId: string, organizationId: string) {
    await this.ensureBusinessUnitBelongsToOrg(businessUnitId, organizationId);

    return this.prisma.stockBalance.findMany({
      where: { businessUnitId },
      include: { ingredient: true },
      orderBy: { ingredient: { name: 'asc' } },
    });
  }

  /// RF-018/BR-011: DETECÇÃO de ingredientes abaixo do estoque mínimo.
  /// Não implementa entrega de alerta (e-mail/push) — PD-008 (canais e
  /// responsáveis pelos alertas) segue sem definição.
  async listBelowMinimum(businessUnitId: string, organizationId: string) {
    await this.ensureBusinessUnitBelongsToOrg(businessUnitId, organizationId);

    const balances = await this.prisma.stockBalance.findMany({
      where: { businessUnitId },
      include: { ingredient: true },
    });

    return balances.filter((balance: any) => {
      const minimum = balance.ingredient.minimumStock;
      return minimum !== null && Number(balance.currentQuantity) < Number(minimum);
    });
  }

  async listMovements(businessUnitId: string, organizationId: string, ingredientId?: string) {
    await this.ensureBusinessUnitBelongsToOrg(businessUnitId, organizationId);

    return this.prisma.stockMovement.findMany({
      where: { businessUnitId, ingredientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /// RF-026 ("consumo"): soma das saídas (OUT) por ingrediente num
  /// período — hoje reflete apenas ajustes manuais (perda/desperdício/
  /// correção/devolução), já que baixa por venda (RF-016/BR-009) depende
  /// do módulo de Vendas (Etapa 16), ainda não implementado.
  async getConsumptionSummary(
    businessUnitId: string,
    organizationId: string,
    from: Date,
    to: Date,
  ) {
    await this.ensureBusinessUnitBelongsToOrg(businessUnitId, organizationId);

    const movements = await this.prisma.stockMovement.findMany({
      where: { businessUnitId, direction: 'OUT', createdAt: { gte: from, lte: to } },
      include: { ingredient: true },
    });

    const byIngredient = new Map<
      string,
      { ingredientId: string; ingredientName: string; totalConsumed: number }
    >();
    for (const movement of movements as any[]) {
      const key = movement.ingredientId;
      const entry = byIngredient.get(key) ?? {
        ingredientId: movement.ingredientId,
        ingredientName: movement.ingredient.name,
        totalConsumed: 0,
      };
      entry.totalConsumed = round4(entry.totalConsumed + Number(movement.quantityStandardUnit));
      byIngredient.set(key, entry);
    }

    return Array.from(byIngredient.values()).sort((a, b) => b.totalConsumed - a.totalConsumed);
  }

  private async ensureBusinessUnitBelongsToOrg(businessUnitId: string, organizationId: string) {
    const businessUnit = await this.prisma.businessUnit.findFirst({
      where: { id: businessUnitId, organizationId },
    });
    if (!businessUnit) {
      throw new NotFoundException('Unidade de negócio não encontrada.');
    }
  }
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
