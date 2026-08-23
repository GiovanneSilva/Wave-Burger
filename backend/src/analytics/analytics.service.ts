import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FichaTecnicaService } from '../ficha-tecnica/ficha-tecnica.service';
import { StockService } from '../stock/stock.service';
import { FinancialService } from '../financial/financial.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { convertQuantity } from '../common/unit-conversion';
import { calculateDeliverableQuantity } from './deliverable-quantity-calculator';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fichaTecnicaService: FichaTecnicaService,
    private readonly stockService: StockService,
    private readonly financialService: FinancialService,
    private readonly suppliersService: SuppliersService,
  ) {}

  /// RF-025: dashboard executivo. Indicadores dependentes de volume de
  /// vendas (produtos mais vendidos, ticket médio, ponto de equilíbrio)
  /// retornam `null` com nota explicativa — dependem do módulo de Vendas
  /// (Etapa 16, PD-010, ainda não implementado).
  async getExecutiveDashboard(
    businessUnitId: string,
    organizationId: string,
    from: Date,
    to: Date,
  ) {
    const [dre, cashFlow, produtosMaisLucrativos] = await Promise.all([
      this.financialService.getDre(businessUnitId, organizationId, from, to),
      this.financialService.getCashFlow(businessUnitId, organizationId, from, to),
      this.getMostProfitableProducts(organizationId, 10),
    ]);

    return {
      periodo: { from, to },
      faturamento: cashFlow.entradas,
      cmv: dre.cmv,
      margemBruta: dre.receitaBruta > 0 ? round2((dre.lucroBruto / dre.receitaBruta) * 100) : null,
      lucroOperacional: dre.resultadoOperacional,
      produtosMaisLucrativos,
      produtosMaisVendidos: null,
      ticketMedio: null,
      pontoDeEquilibrio: null,
      indicadoresNaoDisponiveis:
        'produtosMaisVendidos, ticketMedio e pontoDeEquilibrio dependem do módulo de Vendas ' +
        '(Etapa 16, PD-010, ainda não implementado). pontoDeEquilibrio também depende de uma ' +
        'classificação de custos fixos/variáveis ainda não definida no Documento Mestre.',
    };
  }

  /// RF-025 ("produtos mais lucrativos") + BR-017 (indicadores devem
  /// refletir custo ATUAL, não o snapshot congelado da versão). Reutiliza
  /// FichaTecnicaService.getCurrentCostSummary (Etapa 10) por produto —
  /// nenhuma lógica de cálculo duplicada.
  async getMostProfitableProducts(organizationId: string, limit: number) {
    const productsWithFicha = await this.prisma.product.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        fichasTecnicas: { some: { isCurrent: true } },
      },
      select: { id: true, name: true },
    });

    const summaries = await Promise.all(
      productsWithFicha.map(async (product: { id: string; name: string }) => {
        const summary = await this.fichaTecnicaService.getCurrentCostSummary(
          product.id,
          organizationId,
        );
        return {
          productId: product.id,
          productName: product.name,
          estimatedProfit: summary.currentLive.estimatedProfit,
          marginPercentage: summary.currentLive.marginPercentage,
        };
      }),
    );

    return summaries
      .filter((s: any) => s.estimatedProfit !== null)
      .sort((a: any, b: any) => (b.estimatedProfit ?? 0) - (a.estimatedProfit ?? 0))
      .slice(0, limit);
  }

  /// RF-026: dashboard de estoque — inteiramente derivado do módulo de
  /// Estoque (Etapa 13), sem lógica nova além da composição.
  async getStockDashboard(businessUnitId: string, organizationId: string, from: Date, to: Date) {
    const [balances, criticalIngredients, recentMovements, consumption] = await Promise.all([
      this.stockService.listBalances(businessUnitId, organizationId),
      this.stockService.listBelowMinimum(businessUnitId, organizationId),
      this.stockService.listMovements(businessUnitId, organizationId),
      this.stockService.getConsumptionSummary(businessUnitId, organizationId, from, to),
    ]);

    return {
      periodo: { from, to },
      estoqueAtual: balances,
      ingredientesCriticos: criticalIngredients,
      movimentacoesRecentes: recentMovements.slice(0, 50),
      consumoPeriodo: consumption,
    };
  }

  /// RF-027: análise de fornecedores para um ingrediente — histórico de
  /// preços derivado de PurchaseItem (Etapa 12, apenas compras
  /// CONFIRMED), fornecedores vinculados via SuppliersService (Etapa 11,
  /// sem lógica duplicada).
  async getSupplierAnalysis(ingredientId: string, organizationId: string) {
    const ingredient = await this.prisma.ingredient.findFirst({
      where: { id: ingredientId, organizationId },
    });
    if (!ingredient) {
      throw new NotFoundException('Ingrediente não encontrado.');
    }

    const purchaseItems = await this.prisma.purchaseItem.findMany({
      where: {
        ingredientId,
        purchase: { organizationId, status: 'CONFIRMED' },
      },
      include: { purchase: { include: { supplier: true } } },
      orderBy: { purchase: { purchaseDate: 'desc' } },
    });

    const priceHistory = purchaseItems.map((item: any) => ({
      supplierId: item.purchase.supplierId,
      supplierName: item.purchase.supplier.name,
      purchaseDate: item.purchase.purchaseDate,
      unitPrice: item.unitPrice,
      unit: item.unit,
    }));

    const prices: number[] = purchaseItems.map((item: any) => Number(item.unitPrice));
    const priceVariation =
      prices.length > 0
        ? {
            min: Math.min(...prices),
            max: Math.max(...prices),
            average: round4(prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length),
          }
        : null;

    const linkedSuppliers = await this.suppliersService.findSuppliersByIngredient(
      ingredientId,
      organizationId,
    );

    return {
      ingredientId,
      ingredientName: ingredient.name,
      custoMedio: ingredient.averageCost,
      ultimoCusto: ingredient.lastCost,
      ultimaCompra: priceHistory[0] ?? null,
      historicoPrecos: priceHistory,
      variacaoPreco: priceVariation,
      fornecedoresVinculados: linkedSuppliers,
    };
  }

  /// "Quanto dá pra entregar com o estoque de hoje" — para cada produto
  /// ATIVO, olha a ficha técnica corrente e acha o ingrediente que vai
  /// faltar primeiro (o "gargalo"), seguindo o padrão indicador → causa
  /// do brief de design (não é só um número, já aponta o porquê).
  ///
  /// Deliberadamente consistente com o que `SalesService.registerSale`
  /// REALMENTE desconta do estoque hoje (Etapa 16) — ou seja, SEM ajuste
  /// de `lossPercentage`. Isso expõe uma inconsistência pré-existente:
  /// o custo da ficha técnica INFLA a quantidade por `lossPercentage`
  /// (RF-004), mas a baixa de estoque na venda não aplica esse ajuste.
  /// Não foi corrigido aqui — está documentado no CLAUDE.md como
  /// pendência, já que mudar o desconto de estoque é uma decisão de
  /// negócio que não foi pedida nesta tarefa.
  async getDeliverableQuantities(businessUnitId: string, organizationId: string) {
    const products = await this.prisma.product.findMany({
      where: { organizationId, status: 'ACTIVE' },
      select: { id: true, name: true },
    });

    const results = await Promise.all(
      products.map(async (product: { id: string; name: string }) => {
        const ficha = await this.prisma.fichaTecnica.findFirst({
          where: { productId: product.id, isCurrent: true },
          include: { items: { include: { ingredient: true } } },
        });

        if (!ficha || (ficha as any).items.length === 0) {
          return {
            productId: product.id,
            productName: product.name,
            deliverableQuantity: 0,
            limitingIngredientId: null,
            limitingIngredientName: null,
          };
        }

        const requirements = await Promise.all(
          (ficha as any).items.map(async (item: any) => {
            const consumptionPerUnitStandardUnit = convertQuantity(
              Number(item.quantity),
              item.unit,
              item.ingredient.standardUnit,
            );
            const balance = await this.prisma.stockBalance.findUnique({
              where: {
                businessUnitId_ingredientId: { businessUnitId, ingredientId: item.ingredientId },
              },
            });

            return {
              ingredientId: item.ingredientId,
              ingredientName: item.ingredient.name,
              consumptionPerUnitStandardUnit,
              currentStockStandardUnit: balance ? Number((balance as any).currentQuantity) : 0,
            };
          }),
        );

        return {
          productId: product.id,
          productName: product.name,
          ...calculateDeliverableQuantity(requirements),
        };
      }),
    );

    return results.sort((a, b) => a.deliverableQuantity - b.deliverableQuantity);
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
