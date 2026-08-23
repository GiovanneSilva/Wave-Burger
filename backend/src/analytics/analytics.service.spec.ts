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
      fichaTecnica: { findFirst: jest.fn() },
      stockBalance: { findUnique: jest.fn() },
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

  describe('getDeliverableQuantities', () => {
    it('EXEMPLO COMPLETO: identifica o pão como gargalo (mesmo cenário do calculator)', async () => {
      prisma.product.findMany.mockResolvedValue([{ id: 'prod-1', name: 'Smash Burger' }]);
      prisma.fichaTecnica.findFirst.mockResolvedValue({
        items: [
          {
            ingredientId: 'ing-carne',
            quantity: '160',
            unit: 'g',
            ingredient: { standardUnit: 'kg', name: 'Carne Bovina' },
          },
          {
            ingredientId: 'ing-pao',
            quantity: '1',
            unit: 'un',
            ingredient: { standardUnit: 'un', name: 'Pão Brioche' },
          },
        ],
      });
      prisma.stockBalance.findUnique.mockImplementation(({ where }: any) => {
        const id = where.businessUnitId_ingredientId.ingredientId;
        if (id === 'ing-carne') return Promise.resolve({ currentQuantity: '3.24' });
        if (id === 'ing-pao') return Promise.resolve({ currentQuantity: '5' });
        return Promise.resolve(null);
      });

      const result = await service.getDeliverableQuantities('bu-1', 'org-1');

      expect(result).toEqual([
        {
          productId: 'prod-1',
          productName: 'Smash Burger',
          deliverableQuantity: 5,
          limitingIngredientId: 'ing-pao',
          limitingIngredientName: 'Pão Brioche',
        },
      ]);
    });

    it('retorna 0 para produto ativo sem ficha técnica corrente', async () => {
      prisma.product.findMany.mockResolvedValue([{ id: 'prod-2', name: 'Sem Ficha' }]);
      prisma.fichaTecnica.findFirst.mockResolvedValue(null);

      const result = await service.getDeliverableQuantities('bu-1', 'org-1');

      expect(result[0]).toEqual(
        expect.objectContaining({
          productId: 'prod-2',
          deliverableQuantity: 0,
          limitingIngredientId: null,
        }),
      );
    });

    it('trata ingrediente nunca comprado (sem StockBalance) como estoque zero', async () => {
      prisma.product.findMany.mockResolvedValue([{ id: 'prod-1', name: 'Smash Burger' }]);
      prisma.fichaTecnica.findFirst.mockResolvedValue({
        items: [
          {
            ingredientId: 'ing-novo',
            quantity: '50',
            unit: 'g',
            ingredient: { standardUnit: 'kg', name: 'Ingrediente Novo' },
          },
        ],
      });
      prisma.stockBalance.findUnique.mockResolvedValue(null);

      const result = await service.getDeliverableQuantities('bu-1', 'org-1');

      expect(result[0].deliverableQuantity).toBe(0);
    });

    it('ordena os produtos do mais urgente (menor quantidade entregável) para o menos', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: 'prod-farto', name: 'Fartura' },
        { id: 'prod-critico', name: 'Crítico' },
      ]);
      prisma.fichaTecnica.findFirst.mockImplementation(({ where }: any) => {
        if (where.productId === 'prod-farto') {
          return Promise.resolve({
            items: [
              {
                ingredientId: 'ing-a',
                quantity: '1',
                unit: 'un',
                ingredient: { standardUnit: 'un', name: 'A' },
              },
            ],
          });
        }
        return Promise.resolve({
          items: [
            {
              ingredientId: 'ing-b',
              quantity: '1',
              unit: 'un',
              ingredient: { standardUnit: 'un', name: 'B' },
            },
          ],
        });
      });
      prisma.stockBalance.findUnique.mockImplementation(({ where }: any) => {
        const id = where.businessUnitId_ingredientId.ingredientId;
        if (id === 'ing-a') return Promise.resolve({ currentQuantity: '100' });
        return Promise.resolve({ currentQuantity: '2' });
      });

      const result = await service.getDeliverableQuantities('bu-1', 'org-1');

      expect(result[0].productId).toBe('prod-critico');
      expect(result[1].productId).toBe('prod-farto');
    });
  });
});
