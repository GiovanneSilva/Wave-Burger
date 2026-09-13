import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateIngredientDto, UpdateIngredientDto } from './dto/ingredient.dto';
import { convertQuantity } from '../common/unit-conversion';
import { calculateWeightedAverageCost } from './average-cost-calculator';

interface ActingUser {
  id: string;
  organizationId: string;
}

@Injectable()
export class IngredientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateIngredientDto, actor: ActingUser) {
    const existing = await this.prisma.ingredient.findFirst({
      where: { organizationId: actor.organizationId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException('Já existe um ingrediente com este nome nesta organização.');
    }

    const created = await this.prisma.ingredient.create({
      data: {
        organizationId: actor.organizationId,
        name: dto.name,
        category: dto.category,
        standardUnit: dto.standardUnit,
        storageLocation: dto.storageLocation,
        minimumStock: dto.minimumStock,
        averageCost: dto.averageCost,
        lastCost: dto.lastCost,
      },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'CREATE',
      entity: 'Ingredient',
      entityId: created.id,
      newValue: created,
    });

    return created;
  }

  async findAll(organizationId: string) {
    return this.prisma.ingredient.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, organizationId: string) {
    const ingredient = await this.prisma.ingredient.findFirst({
      where: { id, organizationId },
    });
    if (!ingredient) {
      throw new NotFoundException('Ingrediente não encontrado.');
    }
    return ingredient;
  }

  async update(id: string, dto: UpdateIngredientDto, actor: ActingUser) {
    const before = await this.findById(id, actor.organizationId);

    if (dto.name && dto.name !== before.name) {
      const nameTaken = await this.prisma.ingredient.findFirst({
        where: { organizationId: actor.organizationId, name: dto.name, NOT: { id } },
      });
      if (nameTaken) {
        throw new ConflictException('Já existe um ingrediente com este nome nesta organização.');
      }
    }

    const costChanged =
      (dto.averageCost !== undefined && dto.averageCost !== before.averageCost?.toString()) ||
      (dto.lastCost !== undefined && dto.lastCost !== before.lastCost?.toString());

    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        standardUnit: dto.standardUnit,
        storageLocation: dto.storageLocation,
        minimumStock: dto.minimumStock,
        averageCost: dto.averageCost,
        lastCost: dto.lastCost,
        ...(costChanged ? { lastPurchaseDate: new Date() } : {}),
      },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'UPDATE',
      entity: 'Ingredient',
      entityId: id,
      previousValue: before,
      newValue: updated,
      metadata: costChanged
        ? {
            note: 'Custo alterado. Recalculo de produtos afetados (BR-004) ainda não implementado — depende do módulo de Ficha Técnica (Etapa 10).',
          }
        : undefined,
    });

    return updated;
  }

  /// Inativa o ingrediente — nunca exclusão física (RF-003, aplicado por
  /// consistência arquitetural a Ingrediente).
  async deactivate(id: string, actor: ActingUser) {
    const before = await this.findById(id, actor.organizationId);
    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'DEACTIVATE',
      entity: 'Ingredient',
      entityId: id,
      previousValue: before,
      newValue: updated,
    });

    return updated;
  }

  async activate(id: string, actor: ActingUser) {
    const before = await this.findById(id, actor.organizationId);
    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: { isActive: true },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'ACTIVATE',
      entity: 'Ingredient',
      entityId: id,
      previousValue: before,
      newValue: updated,
    });

    return updated;
  }

  /// Recalcula `averageCost` a partir das DUAS últimas compras
  /// confirmadas deste ingrediente — pedido explícito do usuário
  /// (05/09/2026), alternativa mais simples ao custo médio ponderado
  /// móvel automático (que só passa a valer a partir da PRÓXIMA compra
  /// confirmada): ingredientes já cadastrados antes da correção de
  /// PD-002, com estoque real mas sem custo médio definido, ficariam
  /// sujeitos a uma distorção se a próxima compra tratasse esse estoque
  /// existente como se valesse R$0. Usar só as duas últimas compras
  /// reais evita essa distorção, sem precisar do usuário digitar um
  /// valor no chute.
  ///
  /// Reaproveita `calculateWeightedAverageCost` — mesma fórmula usada
  /// automaticamente a cada compra confirmada (`IngredientsPurchaseListener`),
  /// só que aqui a "quantidade/custo anterior" vem da penúltima compra
  /// histórica, não do estado atual do ingrediente.
  async recalculateAverageCostFromLastPurchases(id: string, actor: ActingUser) {
    const ingredient = await this.findById(id, actor.organizationId);

    const lastPurchaseItems = await this.prisma.purchaseItem.findMany({
      where: {
        ingredientId: id,
        purchase: { organizationId: actor.organizationId, status: 'CONFIRMED' },
      },
      include: { purchase: { select: { confirmedAt: true } } },
      orderBy: { purchase: { confirmedAt: 'desc' } },
      take: 2,
    });

    if (lastPurchaseItems.length === 0) {
      throw new UnprocessableEntityException(
        'Nenhuma compra confirmada encontrada para este ingrediente — não é possível recalcular o custo médio.',
      );
    }

    const toStandardUnit = (item: (typeof lastPurchaseItems)[number]) =>
      convertQuantity(Number(item.quantity), item.unit, ingredient.standardUnit);

    let newAverageCost: number;

    if (lastPurchaseItems.length === 1) {
      // Só uma compra no histórico — não há o que ponderar, o custo
      // médio é simplesmente o preço dessa única compra.
      newAverageCost =
        Number(lastPurchaseItems[0].totalPrice) / toStandardUnit(lastPurchaseItems[0]);
    } else {
      const [ultima, penultima] = lastPurchaseItems; // ordenado desc: [0]=mais recente
      newAverageCost = calculateWeightedAverageCost({
        previousQuantity: toStandardUnit(penultima),
        previousAverageCost: Number(penultima.totalPrice) / toStandardUnit(penultima),
        purchaseQuantity: toStandardUnit(ultima),
        purchaseTotalValue: Number(ultima.totalPrice),
      });
    }

    const before = ingredient;
    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: { averageCost: newAverageCost },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'RECALCULATE_AVERAGE_COST',
      entity: 'Ingredient',
      entityId: id,
      previousValue: { averageCost: before.averageCost },
      newValue: { averageCost: updated.averageCost },
      metadata: {
        basedOnPurchaseCount: lastPurchaseItems.length,
        note: 'Recalculado a partir das últimas compras confirmadas, a pedido do usuário (PD-002).',
      },
    });

    return updated;
  }
}
