import { IfoodInventorySyncService } from './ifood-inventory-sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { IfoodAuthService } from './ifood-auth.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ConfigService } from '@nestjs/config';

describe('IfoodInventorySyncService', () => {
  let service: IfoodInventorySyncService;
  let prisma: any;
  let authService: { getAccessToken: jest.Mock };
  let analyticsService: { getDeliverableQuantities: jest.Mock };
  let configService: { get: jest.Mock };
  const originalFetch = global.fetch;

  beforeEach(() => {
    prisma = { businessUnit: { findMany: jest.fn() } };
    authService = { getAccessToken: jest.fn().mockResolvedValue('token-abc') };
    analyticsService = { getDeliverableQuantities: jest.fn() };
    configService = { get: jest.fn((_key: string, fallback?: string) => fallback) };
    global.fetch = jest.fn();

    service = new IfoodInventorySyncService(
      prisma as unknown as PrismaService,
      authService as unknown as IfoodAuthService,
      analyticsService as unknown as AnalyticsService,
      configService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('syncInventory', () => {
    it('EXEMPLO COMPLETO: envia a quantidade entregável de cada produto pro inventário do iFood', async () => {
      analyticsService.getDeliverableQuantities.mockResolvedValue([
        {
          productId: 'prod-1',
          productName: 'Smash Burger',
          deliverableQuantity: 34,
          limitingIngredientId: 'ing-1',
          limitingIngredientName: 'Carne',
        },
        {
          productId: 'prod-2',
          productName: 'Veggie Burger',
          deliverableQuantity: 0,
          limitingIngredientId: 'ing-2',
          limitingIngredientName: 'Pão',
        },
      ]);
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const results = await service.syncInventory('bu-1', 'org-1', 'merchant-1');

      expect(results).toEqual([
        { productId: 'prod-1', productName: 'Smash Burger', quantity: 34, success: true },
        { productId: 'prod-2', productName: 'Veggie Burger', quantity: 0, success: true },
      ]);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      const firstCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(firstCall[0]).toContain('/catalog/v2.0/merchants/merchant-1/inventory');
      const sentBody = JSON.parse(firstCall[1].body);
      expect(sentBody).toEqual({ productId: 'prod-1', amount: 34 });
    });

    it('envia 0 corretamente quando o produto está esgotado — é isso que pausa o item no iFood', async () => {
      analyticsService.getDeliverableQuantities.mockResolvedValue([
        {
          productId: 'prod-1',
          productName: 'Esgotado',
          deliverableQuantity: 0,
          limitingIngredientId: null,
          limitingIngredientName: null,
        },
      ]);
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await service.syncInventory('bu-1', 'org-1', 'merchant-1');

      const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(sentBody.amount).toBe(0);
    });

    it('uma falha num produto não impede a sincronização dos demais', async () => {
      analyticsService.getDeliverableQuantities.mockResolvedValue([
        {
          productId: 'prod-1',
          productName: 'A',
          deliverableQuantity: 5,
          limitingIngredientId: null,
          limitingIngredientName: null,
        },
        {
          productId: 'prod-2',
          productName: 'B',
          deliverableQuantity: 10,
          limitingIngredientId: null,
          limitingIngredientName: null,
        },
      ]);
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: async () => 'produto não encontrado',
        })
        .mockResolvedValueOnce({ ok: true });

      const results = await service.syncInventory('bu-1', 'org-1', 'merchant-1');

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('404');
      expect(results[1].success).toBe(true);
    });

    it('CORREÇÃO REAL: envia o campo "amount" (não "quantity") como inteiro — erro real: PostInventoryItemDTO.amount', async () => {
      analyticsService.getDeliverableQuantities.mockResolvedValue([
        {
          productId: 'prod-1',
          productName: 'Smash Burger',
          deliverableQuantity: 34,
          limitingIngredientId: null,
          limitingIngredientName: null,
        },
      ]);
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await service.syncInventory('bu-1', 'org-1', 'merchant-1');

      const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(sentBody).toEqual({ productId: 'prod-1', amount: 34 });
      expect(Number.isInteger(sentBody.amount)).toBe(true);
      expect(sentBody).not.toHaveProperty('quantity');
    });

    it('não sincroniza nada quando não há produtos ativos', async () => {
      analyticsService.getDeliverableQuantities.mockResolvedValue([]);

      const results = await service.syncInventory('bu-1', 'org-1', 'merchant-1');

      expect(results).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('syncAllBusinessUnits', () => {
    it('sincroniza cada unidade de negócio com loja do iFood configurada', async () => {
      prisma.businessUnit.findMany.mockResolvedValue([
        { id: 'bu-1', organizationId: 'org-1', ifoodMerchantId: 'merchant-1' },
        { id: 'bu-2', organizationId: 'org-2', ifoodMerchantId: 'merchant-2' },
      ]);
      analyticsService.getDeliverableQuantities.mockResolvedValue([]);

      await service.syncAllBusinessUnits();

      expect(analyticsService.getDeliverableQuantities).toHaveBeenCalledWith('bu-1', 'org-1');
      expect(analyticsService.getDeliverableQuantities).toHaveBeenCalledWith('bu-2', 'org-2');
    });

    it('não faz nada quando nenhuma unidade tem loja do iFood configurada', async () => {
      prisma.businessUnit.findMany.mockResolvedValue([]);

      await service.syncAllBusinessUnits();

      expect(analyticsService.getDeliverableQuantities).not.toHaveBeenCalled();
    });
  });

  describe('handleInventorySync', () => {
    it('captura exceções sem propagar (não derruba o cron)', async () => {
      prisma.businessUnit.findMany.mockRejectedValue(new Error('banco fora do ar'));

      await expect(service.handleInventorySync()).resolves.toBeUndefined();
    });
  });
});
