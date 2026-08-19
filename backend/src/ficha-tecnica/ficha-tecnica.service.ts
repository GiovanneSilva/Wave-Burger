import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateFichaTecnicaDto } from './dto/create-ficha-tecnica.dto';
import { SimulateFichaTecnicaDto } from './dto/simulate-ficha-tecnica.dto';
import { calculateItemCost, calculateTotals } from './ficha-tecnica-calculator';

interface ActingUser {
  id: string;
  organizationId: string;
}

interface IngredientRecord {
  id: string;
  name: string;
  standardUnit: string;
  averageCost: unknown;
  isActive: boolean;
}

@Injectable()
export class FichaTecnicaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /// RF-004/RF-005/RF-006/RF-007: cria uma NOVA versão da ficha técnica.
  /// Nunca atualiza uma versão existente — cada chamada gera version+1 e
  /// marca a anterior como não-corrente (BR-005, imutabilidade).
  async createNewVersion(productId: string, dto: CreateFichaTecnicaDto, actor: ActingUser) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: actor.organizationId },
    });
    if (!product) {
      throw new NotFoundException('Produto não encontrado.');
    }

    if (!dto.items || dto.items.length === 0) {
      // Defesa em profundidade — o DTO já valida isso (BR-002).
      throw new BadRequestException(
        'A ficha técnica deve possuir ao menos um ingrediente (BR-002).',
      );
    }

    const ingredientIds = dto.items.map((item) => item.ingredientId);
    const ingredients = await this.prisma.ingredient.findMany({
      where: { id: { in: ingredientIds }, organizationId: actor.organizationId },
    });
    const ingredientById = new Map<string, IngredientRecord>(
      ingredients.map((i: IngredientRecord) => [i.id, i]),
    );

    const itemCalculations = dto.items.map((itemDto) => {
      const ingredient = ingredientById.get(itemDto.ingredientId);
      if (!ingredient) {
        throw new NotFoundException(`Ingrediente ${itemDto.ingredientId} não encontrado.`);
      }
      // UC-002, fluxo alternativo: "Ingrediente inativo não poderá ser
      // utilizado em nova composição."
      if (!ingredient.isActive) {
        throw new UnprocessableEntityException(
          `O ingrediente "${ingredient.name}" está inativo e não pode ser usado em uma nova composição.`,
        );
      }
      if (ingredient.averageCost === null) {
        throw new UnprocessableEntityException(
          `O ingrediente "${ingredient.name}" não possui custo médio cadastrado — não é possível calcular a ficha técnica.`,
        );
      }

      const costPerStandardUnit = Number(ingredient.averageCost);
      const { lineCost } = calculateItemCost({
        quantity: Number(itemDto.quantity),
        unit: itemDto.unit,
        ingredientStandardUnit: ingredient.standardUnit,
        lossPercentage: itemDto.lossPercentage ?? 0,
        costPerStandardUnit,
      });

      return {
        ingredientId: ingredient.id,
        quantity: itemDto.quantity,
        unit: itemDto.unit,
        lossPercentage: itemDto.lossPercentage ?? 0,
        costSnapshot: costPerStandardUnit,
        lineCost,
      };
    });

    const totals = calculateTotals(
      itemCalculations.map((i) => i.lineCost),
      product.salePrice ? Number(product.salePrice) : null,
    );

    const currentVersion = await this.prisma.fichaTecnica.findFirst({
      where: { productId, isCurrent: true },
    });
    const nextVersion = (currentVersion?.version ?? 0) + 1;

    const created = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (currentVersion) {
        await tx.fichaTecnica.update({
          where: { id: currentVersion.id },
          data: { isCurrent: false },
        });
      }

      return tx.fichaTecnica.create({
        data: {
          productId,
          version: nextVersion,
          isCurrent: true,
          ingredientsCost: totals.ingredientsCost,
          totalCost: totals.totalCost,
          cmvPercentage: totals.cmvPercentage,
          markup: totals.markup,
          marginPercentage: totals.marginPercentage,
          estimatedProfit: totals.estimatedProfit,
          createdByUserId: actor.id,
          items: {
            create: itemCalculations,
          },
        },
        include: { items: true },
      });
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'CREATE_VERSION',
      entity: 'FichaTecnica',
      entityId: created.id,
      newValue: created,
      metadata: { productId, version: nextVersion },
    });

    return created;
  }

  async findCurrentByProduct(productId: string, organizationId: string) {
    await this.ensureProductBelongsToOrg(productId, organizationId);

    const current = await this.prisma.fichaTecnica.findFirst({
      where: { productId, isCurrent: true },
      include: { items: { include: { ingredient: true } } },
    });
    if (!current) {
      throw new NotFoundException('Este produto ainda não possui ficha técnica.');
    }
    return current;
  }

  async findHistoryByProduct(productId: string, organizationId: string) {
    await this.ensureProductBelongsToOrg(productId, organizationId);

    return this.prisma.fichaTecnica.findMany({
      where: { productId },
      orderBy: { version: 'desc' },
      include: { items: true },
    });
  }

  /// BR-004: "Alteração de custo de ingrediente deverá atualizar os
  /// cálculos dos produtos que o utilizam." Recalcula os indicadores da
  /// versão CORRENTE usando o custo ATUAL de cada ingrediente — sem jamais
  /// sobrescrever o snapshot histórico armazenado (que é BR-005).
  async getCurrentCostSummary(productId: string, organizationId: string) {
    const current = await this.findCurrentByProduct(productId, organizationId);
    const product = await this.prisma.product.findFirstOrThrow({ where: { id: productId } });

    const liveLineCosts = current.items.map((item: any) => {
      const ingredient = item.ingredient;
      const costPerStandardUnit =
        ingredient.averageCost !== null ? Number(ingredient.averageCost) : 0;
      const { lineCost } = calculateItemCost({
        quantity: Number(item.quantity),
        unit: item.unit,
        ingredientStandardUnit: ingredient.standardUnit,
        lossPercentage: Number(item.lossPercentage),
        costPerStandardUnit,
      });
      return lineCost;
    });

    const liveTotals = calculateTotals(
      liveLineCosts,
      product.salePrice ? Number(product.salePrice) : null,
    );

    return {
      productId,
      version: current.version,
      frozenAtVersionCreation: {
        ingredientsCost: current.ingredientsCost,
        totalCost: current.totalCost,
        cmvPercentage: current.cmvPercentage,
        markup: current.markup,
        marginPercentage: current.marginPercentage,
        estimatedProfit: current.estimatedProfit,
      },
      currentLive: liveTotals,
      costDrifted: Number(current.totalCost) !== liveTotals.totalCost,
    };
  }

  /// RF-008: simula alterações na ficha técnica ANTES de aplicá-las —
  /// nenhuma escrita ocorre (nem nova versão, nem alteração de custo do
  /// ingrediente). Cobre os 4 exemplos do RF-008:
  ///   - "aumentar gramatura": mudar `quantity` de um item;
  ///   - "trocar fornecedor": usar `costOverride` (preço hipotético,
  ///     sem alterar Ingredient.averageCost de verdade);
  ///   - "alterar preço" / "conceder desconto": usar `salePriceOverride`.
  /// Reutiliza os mesmos calculateItemCost/calculateTotals da criação
  /// real de ficha técnica (Etapa 10) — nenhum cálculo duplicado.
  ///
  /// Não gera auditoria: uma simulação não muda estado nenhum, então não
  /// é uma "ação crítica" no sentido de RF-033.
  async simulate(productId: string, dto: SimulateFichaTecnicaDto, organizationId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
    });
    if (!product) {
      throw new NotFoundException('Produto não encontrado.');
    }

    const ingredientIds = dto.items.map((item) => item.ingredientId);
    const ingredients = await this.prisma.ingredient.findMany({
      where: { id: { in: ingredientIds }, organizationId },
    });
    const ingredientById = new Map<string, IngredientRecord>(
      ingredients.map((i: IngredientRecord) => [i.id, i]),
    );

    const itemResults = dto.items.map((itemDto) => {
      const ingredient = ingredientById.get(itemDto.ingredientId);
      if (!ingredient) {
        throw new NotFoundException(`Ingrediente ${itemDto.ingredientId} não encontrado.`);
      }

      const costPerStandardUnit = itemDto.costOverride
        ? Number(itemDto.costOverride)
        : ingredient.averageCost !== null
          ? Number(ingredient.averageCost)
          : null;

      if (costPerStandardUnit === null) {
        throw new UnprocessableEntityException(
          `O ingrediente "${ingredient.name}" não possui custo médio cadastrado e nenhum costOverride foi informado.`,
        );
      }

      const { lineCost } = calculateItemCost({
        quantity: Number(itemDto.quantity),
        unit: itemDto.unit,
        ingredientStandardUnit: ingredient.standardUnit,
        lossPercentage: itemDto.lossPercentage ?? 0,
        costPerStandardUnit,
      });

      return {
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        quantity: itemDto.quantity,
        unit: itemDto.unit,
        costPerStandardUnitUsed: costPerStandardUnit,
        isSimulatedCost: Boolean(itemDto.costOverride),
        lineCost,
      };
    });

    const salePrice = dto.salePriceOverride
      ? Number(dto.salePriceOverride)
      : product.salePrice
        ? Number(product.salePrice)
        : null;

    const simulatedTotals = calculateTotals(
      itemResults.map((i) => i.lineCost),
      salePrice,
    );

    const currentFicha = await this.prisma.fichaTecnica.findFirst({
      where: { productId, isCurrent: true },
    });

    return {
      productId,
      salePriceUsed: salePrice,
      items: itemResults,
      simulatedTotals,
      comparedToCurrentVersion: currentFicha
        ? {
            totalCostDelta: round4(simulatedTotals.totalCost - Number(currentFicha.totalCost)),
            estimatedProfitDelta:
              simulatedTotals.estimatedProfit !== null && currentFicha.estimatedProfit !== null
                ? round4(simulatedTotals.estimatedProfit - Number(currentFicha.estimatedProfit))
                : null,
          }
        : null,
    };
  }

  private async ensureProductBelongsToOrg(productId: string, organizationId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
    });
    if (!product) {
      throw new NotFoundException('Produto não encontrado.');
    }
  }
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
