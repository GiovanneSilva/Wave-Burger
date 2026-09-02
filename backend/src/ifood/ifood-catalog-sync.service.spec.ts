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

  function mockFetchSequence(...responses: Array<{ ok: boolean; status?: number; body: any }>) {
    const impl = jest.fn();
    for (const r of responses) {
      impl.mockResolvedValueOnce({
        ok: r.ok,
        status: r.status,
        json: async () => r.body,
        text: async () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)),
      });
    }
    global.fetch = impl;
    return impl;
  }

  describe('syncProduct', () => {
    it('sincroniza um produto ativo com sucesso, reaproveitando categoria existente', async () => {
      prisma.product.findFirst.mockResolvedValue({
        id: 'prod-1',
        name: 'Smash Burger',
        category: 'Lanches',
        description: null,
        salePrice: '28.90',
        status: 'ACTIVE',
      });

      const fetchMock = mockFetchSequence(
        { ok: true, body: [{ id: 'cat-lanches-001', name: 'Lanches' }] }, // GET categories
        { ok: true, body: {} }, // PUT items
      );

      const result = await service.syncProduct('prod-1', 'org-1', 'merchant-1');

      expect(result).toEqual({ productId: 'prod-1', productName: 'Smash Burger', success: true });

      // não criou categoria nova (só 2 chamadas: listar + PUT item)
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const putCall = fetchMock.mock.calls[1];
      expect(putCall[0]).toContain('/catalog/v2.0/merchants/merchant-1/items');
      const sentBody = JSON.parse(putCall[1].body);
      expect(sentBody.item.categoryId).toBe('cat-lanches-001');
      expect(sentBody.item.id).toBe('prod-1');
      expect(sentBody.products[0].name).toBe('Smash Burger');
    });

    it('cria a categoria quando ela ainda não existe no iFood', async () => {
      prisma.product.findFirst.mockResolvedValue({
        id: 'prod-1',
        name: 'Smash Burger',
        category: 'Novidades',
        description: null,
        salePrice: '28.90',
        status: 'ACTIVE',
      });

      const fetchMock = mockFetchSequence(
        { ok: true, body: [] }, // GET categories — nenhuma existente
        { ok: true, body: { id: 'cat-novidades-999' } }, // POST categories
        { ok: true, body: {} }, // PUT items
      );

      const result = await service.syncProduct('prod-1', 'org-1', 'merchant-1');

      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(3);

      const createCategoryCall = fetchMock.mock.calls[1];
      expect(createCategoryCall[1].method).toBe('POST');
      const createdBody = JSON.parse(createCategoryCall[1].body);
      expect(createdBody.name).toBe('Novidades');

      const putCall = fetchMock.mock.calls[2];
      const sentBody = JSON.parse(putCall[1].body);
      expect(sentBody.item.categoryId).toBe('cat-novidades-999');
    });

    it('usa a categoria padrão "Cardápio" quando o produto não tem categoria definida', async () => {
      prisma.product.findFirst.mockResolvedValue({
        id: 'prod-1',
        name: 'Smash Burger',
        category: null,
        description: null,
        salePrice: '28.90',
        status: 'ACTIVE',
      });

      const fetchMock = mockFetchSequence(
        { ok: true, body: [{ id: 'cat-default', name: 'Cardápio' }] },
        { ok: true, body: {} },
      );

      await service.syncProduct('prod-1', 'org-1', 'merchant-1');

      const putCall = fetchMock.mock.calls[1];
      const sentBody = JSON.parse(putCall[1].body);
      expect(sentBody.item.categoryId).toBe('cat-default');
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
        category: 'Lanches',
        description: null,
        salePrice: null,
        status: 'ACTIVE',
      });
      mockFetchSequence({ ok: true, body: [{ id: 'cat-1', name: 'Lanches' }] });

      const result = await service.syncProduct('prod-1', 'org-1', 'merchant-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('não tem preço de venda definido');
    });

    it('retorna falha quando o iFood responde com erro HTTP ao salvar o item', async () => {
      prisma.product.findFirst.mockResolvedValue({
        id: 'prod-1',
        name: 'Smash Burger',
        category: 'Lanches',
        description: null,
        salePrice: '28.90',
        status: 'ACTIVE',
      });
      mockFetchSequence(
        { ok: true, body: [{ id: 'cat-1', name: 'Lanches' }] },
        { ok: false, status: 400, body: 'FullItemDto is not valid' },
      );

      const result = await service.syncProduct('prod-1', 'org-1', 'merchant-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('400');
    });

    it('retorna falha quando falha ao listar categorias', async () => {
      prisma.product.findFirst.mockResolvedValue({
        id: 'prod-1',
        name: 'Smash Burger',
        category: 'Lanches',
        description: null,
        salePrice: '28.90',
        status: 'ACTIVE',
      });
      mockFetchSequence({ ok: false, status: 401, body: 'unauthorized' });

      const result = await service.syncProduct('prod-1', 'org-1', 'merchant-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Falha ao listar categorias');
    });
  });

  describe('syncAll', () => {
    it('sincroniza todos os produtos ATIVOS e agrega os resultados', async () => {
      prisma.product.findMany.mockResolvedValue([{ id: 'prod-1' }, { id: 'prod-2' }]);
      prisma.product.findFirst
        .mockResolvedValueOnce({
          id: 'prod-1',
          name: 'A',
          category: 'Lanches',
          description: null,
          salePrice: '10',
          status: 'ACTIVE',
        })
        .mockResolvedValueOnce({
          id: 'prod-2',
          name: 'B',
          category: 'Lanches',
          description: null,
          salePrice: '20',
          status: 'ACTIVE',
        });
      mockFetchSequence(
        { ok: true, body: [{ id: 'cat-1', name: 'Lanches' }] },
        { ok: true, body: {} },
        { ok: true, body: [{ id: 'cat-1', name: 'Lanches' }] },
        { ok: true, body: {} },
      );

      const results = await service.syncAll('org-1', 'merchant-1');

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-1', status: 'ACTIVE' } }),
      );
    });
  });
});
