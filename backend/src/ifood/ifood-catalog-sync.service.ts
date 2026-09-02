import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { IfoodAuthService } from './ifood-auth.service';
import { buildIfoodItemPayload } from './ifood-catalog.mapper';

export interface CatalogSyncResult {
  productId: string;
  productName: string;
  success: boolean;
  error?: string;
}

const DEFAULT_CATEGORY_NAME = 'Cardápio';

/// Integração iFood (Fase 1). Envia nosso catálogo de produtos pro
/// Catalog do iFood — unidirecional (Wave Burger → iFood), o passo de
/// menor risco do plano (não toca em venda nem estoque).
@Injectable()
export class IfoodCatalogSyncService {
  private readonly logger = new Logger(IfoodCatalogSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: IfoodAuthService,
    private readonly configService: ConfigService,
  ) {}

  private get baseUrl(): string {
    return this.configService.get<string>(
      'IFOOD_API_BASE_URL',
      'https://merchant-api.ifood.com.br',
    );
  }

  /// Toda loja no iFood tem ao menos um "catálogo" (geralmente o de
  /// contexto DEFAULT/Entrega) — categorias e itens vivem dentro dele,
  /// não diretamente no merchant. Prefere o catálogo de contexto
  /// DEFAULT; se não encontrar, usa o primeiro da lista.
  private async resolveCatalogId(merchantId: string, token: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/catalog/v2.0/merchants/${merchantId}/catalogs`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Falha ao listar catálogos do iFood (status ${res.status}): ${text}`);
    }

    const catalogs: Array<{ catalogId: string; context: string[] }> = await res.json();
    if (catalogs.length === 0) {
      throw new Error('A loja não tem nenhum catálogo cadastrado no iFood.');
    }

    const defaultCatalog = catalogs.find((c) => c.context?.includes('DEFAULT'));
    return (defaultCatalog ?? catalogs[0]).catalogId;
  }

  /// O Catalog do iFood exige que todo item pertença a uma categoria
  /// já cadastrada no cardápio da loja — diferente do Wave Burger,
  /// onde `Product.category` é só um texto livre opcional. Busca pelo
  /// nome dentro do catálogo resolvido; cria a categoria se ainda não
  /// existir.
  ///
  /// Correção de 02/09/2026: a primeira versão chamava
  /// `.../merchants/{merchantId}/categories` direto — o iFood recusou
  /// com 404 ("no Route matched"). O caminho real exige o `catalogId`
  /// no meio: `.../merchants/{merchantId}/catalogs/{catalogId}/categories`.
  private async resolveCategoryId(
    merchantId: string,
    categoryName: string,
    token: string,
  ): Promise<string> {
    const catalogId = await this.resolveCatalogId(merchantId, token);

    const listRes = await fetch(
      `${this.baseUrl}/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!listRes.ok) {
      const text = await listRes.text().catch(() => '');
      throw new Error(`Falha ao listar categorias do iFood (status ${listRes.status}): ${text}`);
    }

    const categories: Array<{ id: string; name: string }> = await listRes.json();
    const existing = categories.find(
      (c) => c.name.trim().toLowerCase() === categoryName.trim().toLowerCase(),
    );
    if (existing) {
      return existing.id;
    }

    const createRes = await fetch(
      `${this.baseUrl}/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: categoryName,
          status: 'AVAILABLE',
          template: 'DEFAULT',
          sequence: 0,
        }),
      },
    );

    if (!createRes.ok) {
      const text = await createRes.text().catch(() => '');
      throw new Error(
        `Falha ao criar categoria "${categoryName}" no iFood (status ${createRes.status}): ${text}`,
      );
    }

    const created = await createRes.json();
    return created.id;
  }

  /// Sincroniza um único produto — chamado manualmente (tela de
  /// Configurações) ou, futuramente, automaticamente quando um produto
  /// é ativado/editado (ainda não conectado a esse gatilho — isso é
  /// parte de completar a Fase 1, não desta primeira entrega).
  async syncProduct(
    productId: string,
    organizationId: string,
    merchantId: string,
  ): Promise<CatalogSyncResult> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
    });

    if (!product) {
      return {
        productId,
        productName: '(desconhecido)',
        success: false,
        error: 'Produto não encontrado.',
      };
    }

    try {
      const token = await this.authService.getAccessToken();
      const categoryName = (product as any).category?.trim() || DEFAULT_CATEGORY_NAME;
      const categoryId = await this.resolveCategoryId(merchantId, categoryName, token);

      const payload = buildIfoodItemPayload(
        {
          id: product.id,
          name: product.name,
          description: (product as any).description ?? null,
          salePrice: product.salePrice !== null ? Number(product.salePrice) : null,
          status: product.status as 'DRAFT' | 'ACTIVE' | 'INACTIVE',
        },
        categoryId,
      );

      const res = await fetch(`${this.baseUrl}/catalog/v2.0/merchants/${merchantId}/items`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`iFood respondeu ${res.status}: ${text}`);
      }

      return { productId, productName: product.name, success: true };
    } catch (err: any) {
      this.logger.error(
        `Falha ao sincronizar produto "${product.name}" com o iFood: ${err.message}`,
      );
      return { productId, productName: product.name, success: false, error: err.message };
    }
  }

  /// Sincroniza todos os produtos ATIVOS da organização — só produto
  /// vendável faz sentido existir no cardápio do iFood.
  async syncAll(organizationId: string, merchantId: string): Promise<CatalogSyncResult[]> {
    const products = await this.prisma.product.findMany({
      where: { organizationId, status: 'ACTIVE' },
      select: { id: true },
    });

    const results: CatalogSyncResult[] = [];
    for (const product of products) {
      results.push(await this.syncProduct(product.id, organizationId, merchantId));
    }
    return results;
  }
}
