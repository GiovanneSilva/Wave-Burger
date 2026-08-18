import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { FichaTecnicaService } from '../ficha-tecnica/ficha-tecnica.service';
import { StockService } from '../stock/stock.service';
import { FinancialService } from '../financial/financial.service';
import { SuppliersService } from '../suppliers/suppliers.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: any;
  let fichaTecnicaService: any;
  let stockService: any;
  let financialService: any;
  let suppliersService: any;

  beforeEach(() => {
    prisma = {
      product: { findMany: jest.fn() },
      ingredient: { findFirst: jest.fn() },
      purchaseItem: { findMany: jest.fn() },
    };
    fichaTecnicaService = { getCurrentCostSummary: jest.fn() };
    stockService = {
      listBalances: jest.fn(),
      listBelowMinimum: jest.fn(),
      listMovements: jest.fn(),
      getConsumptionSummary: jest.fn(),
    };
    financialService = { getDre: jest.fn(), getCashFlow: jest.fn() };
    suppliersService = { findSuppliersByIngredient: jest.fn() };

    service = new AnalyticsService(
      prisma as unknown as PrismaService,
      fichaTecnicaService as unknown as FichaTecnicaService,
      stockService as unknown as StockService,
      financialService as unknown as FinancialService,
      suppliersService as unknown as SuppliersService,
    );
  });

  describe('getMostProfitableProducts — RF-025/BR-017', () => {
    it('ranqueia produtos por lucro ATUAL (recalculado ao vivo, não o snapshot congelado)', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'Smash Burger' },
        { id: 'prod-2', name: 'Veggie Burger' },
      ]);

      fichaTecnicaService.getCurrentCostSummary.mockImplementation(async (productId: string) => {
        if (productId === 'prod-1') {
          return { currentLive: { estimatedProfit: 19.8, marginPercentage: 68.51 } };
        }
        return { currentLive: { estimatedProfit: 25.0, marginPercentage: 70.0 } };
      });

      const result = await service.getMostProfitableProducts('org-1', 10);

      expect(result[0].productName).toBe('Veggie Burger'); // maior lucro vem primeiro
      expect(result[1].productName).toBe('Smash Burger');
      expect(fichaTecnicaService.getCurrentCostSummary).toHaveBeenCalledWith('prod-1', 'org-1');
      expect(fichaTecnicaService.getCurrentCostSummary).toHaveBeenCalledWith('prod-2', 'org-1');
    });

    it('exclui produtos sem preço definido (estimatedProfit null)', async () => {
      prisma.product.findMany.mockResolvedValue([{ id: 'prod-1', name: 'Rascunho' }]);
      fichaTecnicaService.getCurrentCostSummary.mockResolvedValue({
        currentLive: { estimatedProfit: null, marginPercentage: null },
      });

      const result = await service.getMostProfitableProducts('org-1', 10);

      expect(result).toHaveLength(0);
    });

    it('respeita o limite solicitado', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'A' },
        { id: 'prod-2', name: 'B' },
        { id: 'prod-3', name: 'C' },
      ]);
      fichaTecnicaService.getCurrentCostSummary.mockResolvedValue({
        currentLive: { estimatedProfit: 10, marginPercentage: 50 },
      });

      const result = await service.getMostProfitableProducts('org-1', 2);

      expect(result).toHaveLength(2);
    });
  });

  describe('getExecutiveDashboard — RF-025', () => {
    it('sinaliza explicitamente quais indicadores dependem de Vendas (Etapa 16)', async () => {
      financialService.getDre.mockResolvedValue({
        receitaBruta: 10000,
        cmv: 3000,
        lucroBruto: 5200,
        resultadoOperacional: 2500,
      });
      financialService.getCashFlow.mockResolvedValue({
        entradas: 10000,
        saidas: 7000,
        saldo: 3000,
      });
      prisma.product.findMany.mockResolvedValue([]);

      const result = await service.getExecutiveDashboard(
        'bu-1',
        'org-1',
        new Date('2026-08-01'),
        new Date('2026-08-31'),
      );

      expect(result.faturamento).toBe(10000);
      expect(result.cmv).toBe(3000);
      expect(result.produtosMaisVendidos).toBeNull();
      expect(result.ticketMedio).toBeNull();
      expect(result.pontoDeEquilibrio).toBeNull();
      expect(result.indicadoresNaoDisponiveis).toContain('Vendas');
    });

    it('calcula margem bruta percentual corretamente', async () => {
      financialService.getDre.mockResolvedValue({
        receitaBruta: 10000,
        cmv: 3000,
        lucroBruto: 5200,
        resultadoOperacional: 2500,
      });
      financialService.getCashFlow.mockResolvedValue({
        entradas: 10000,
        saidas: 7000,
        saldo: 3000,
      });
      prisma.product.findMany.mockResolvedValue([]);

      const result = await service.getExecutiveDashboard(
        'bu-1',
        'org-1',
        new Date('2026-08-01'),
        new Date('2026-08-31'),
      );

      expect(result.margemBruta).toBe(52); // 5200/10000*100
    });
  });

  describe('getStockDashboard — RF-026', () => {
    it('compõe balances, criticos, movimentacoes e consumo sem lógica própria de cálculo', async () => {
      stockService.listBalances.mockResolvedValue([{ ingredientId: 'ing-1', currentQuantity: 5 }]);
      stockService.listBelowMinimum.mockResolvedValue([{ ingredientId: 'ing-1' }]);
      stockService.listMovements.mockResolvedValue(
        Array.from({ length: 60 }, (_, i) => ({ id: `mov-${i}` })),
      );
      stockService.getConsumptionSummary.mockResolvedValue([
        { ingredientId: 'ing-1', ingredientName: 'Carne', totalConsumed: 3 },
      ]);

      const result = await service.getStockDashboard(
        'bu-1',
        'org-1',
        new Date('2026-08-01'),
        new Date('2026-08-31'),
      );

      expect(result.estoqueAtual).toHaveLength(1);
      expect(result.ingredientesCriticos).toHaveLength(1);
      expect(result.movimentacoesRecentes).toHaveLength(50); // limitado a 50
      expect(result.consumoPeriodo[0].totalConsumed).toBe(3);
    });
  });

  describe('getSupplierAnalysis — RF-027', () => {
    it('calcula variação de preço (min/max/média) a partir do histórico de compras', async () => {
      prisma.ingredient.findFirst.mockResolvedValue({
        id: 'ing-1',
        name: 'Carne Bovina',
        averageCost: '30.0000',
        lastCost: '32.0000',
      });
      prisma.purchaseItem.findMany.mockResolvedValue([
        {
          unitPrice: '32.0000',
          unit: 'kg',
          purchase: {
            supplierId: 'sup-1',
            purchaseDate: new Date('2026-08-10'),
            supplier: { name: 'Frigorífico A' },
          },
        },
        {
          unitPrice: '28.0000',
          unit: 'kg',
          purchase: {
            supplierId: 'sup-2',
            purchaseDate: new Date('2026-07-10'),
            supplier: { name: 'Frigorífico B' },
          },
        },
      ]);
      suppliersService.findSuppliersByIngredient.mockResolvedValue([
        { supplierId: 'sup-1', isPreferred: true },
        { supplierId: 'sup-2', isPreferred: false },
      ]);

      const result = await service.getSupplierAnalysis('ing-1', 'org-1');

      expect(result.variacaoPreco).toEqual({ min: 28, max: 32, average: 30 });
      expect(result.historicoPrecos).toHaveLength(2);
      expect(result.ultimaCompra?.supplierName).toBe('Frigorífico A');
      expect(result.custoMedio).toBe('30.0000');
    });

    it('retorna variacaoPreco null quando não há histórico de compras', async () => {
      prisma.ingredient.findFirst.mockResolvedValue({
        id: 'ing-1',
        name: 'Carne Bovina',
        averageCost: null,
        lastCost: null,
      });
      prisma.purchaseItem.findMany.mockResolvedValue([]);
      suppliersService.findSuppliersByIngredient.mockResolvedValue([]);

      const result = await service.getSupplierAnalysis('ing-1', 'org-1');

      expect(result.variacaoPreco).toBeNull();
      expect(result.ultimaCompra).toBeNull();
    });
  });
});
