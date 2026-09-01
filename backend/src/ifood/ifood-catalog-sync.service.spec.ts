import { IfoodCatalogSyncService } from './ifood-catalog-sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { IfoodAuthService } from './ifood-auth.service';
import { ConfigService } from '@nestjs/config';

describe('IfoodCatalogSyncService', () => {
  let service: IfoodCatalogSyncService;
  let prisma: any;
  let authService: { getAccessToken: jest.Mock };
  let configService: { get: jest.Mock };
  const originalFetch = global.fetch;

  beforeEach(() => {
    prisma = { product: { findFirst: jest.fn(), findMany: jest.fn() } };
    authService = { getAccessToken: jest.fn().mockResolvedValue('token-abc') };
    configService = { get: jest.fn((_key: string, fallback?: string) => fallback) };
    global.fetch = jest.fn();

    service = new IfoodCatalogSyncService(
      prisma as unknown as PrismaService,
      authService as unknown as IfoodAuthService,
      configService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('syncProduct', () => {
    it('sincroniza um produto ativo com sucesso', async () => {
      prisma.product.findFirst.mockResolvedValue({
        id: 'prod-1',
        name: 'Smash Burger',
        description: null,
        salePrice: '28.90',
        status: 'ACTIVE',
      });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const result = await service.syncProduct('prod-1', 'org-1', 'merchant-1');

      expect(result).toEqual({ productId: 'prod-1', productName: 'Smash Burger', success: true });
      expect(authService.getAccessToken).toHaveBeenCalledWith('org-1');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/catalog/v2.0/merchants/merchant-1/items'),
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({ Authorization: 'Bearer token-abc' }),
        }),
      );
    });

    it('retorna falha quando o produto não existe na organização', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      const result = await service.syncProduct('prod-x', 'org-1', 'merchant-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('não encontrado');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('retorna falha (sem lançar exceção) quando o produto não tem preço', async () => {
      prisma.product.findFirst.mockResolvedValue({
        id: 'prod-1',
        name: 'Sem preço',
        description: null,
        salePrice: null,
        status: 'ACTIVE',
      });

      const result = await service.syncProduct('prod-1', 'org-1', 'merchant-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('não tem preço de venda definido');
    });

    it('retorna falha quando o iFood responde com erro HTTP', async () => {
      prisma.product.findFirst.mockResolvedValue({
        id: 'prod-1',
        name: 'Smash Burger',
        description: null,
        salePrice: '28.90',
        status: 'ACTIVE',
      });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'erro interno',
      });

      const result = await service.syncProduct('prod-1', 'org-1', 'merchant-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });
  });

  describe('syncAll', () => {
    it('sincroniza todos os produtos ATIVOS e agrega os resultados', async () => {
      prisma.product.findMany.mockResolvedValue([{ id: 'prod-1' }, { id: 'prod-2' }]);
      prisma.product.findFirst
        .mockResolvedValueOnce({
          id: 'prod-1',
          name: 'A',
          description: null,
          salePrice: '10',
          status: 'ACTIVE',
        })
        .mockResolvedValueOnce({
          id: 'prod-2',
          name: 'B',
          description: null,
          salePrice: '20',
          status: 'ACTIVE',
        });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const results = await service.syncAll('org-1', 'merchant-1');

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-1', status: 'ACTIVE' } }),
      );
    });
  });
});
