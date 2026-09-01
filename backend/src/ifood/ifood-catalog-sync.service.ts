import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { IfoodAuthService } from './ifood-auth.service';
import { mapProductToIfoodCatalogItem } from './ifood-catalog.mapper';

export interface CatalogSyncResult {
  productId: string;
  productName: string;
  success: boolean;
  error?: string;
}

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
      const payload = mapProductToIfoodCatalogItem({
        id: product.id,
        name: product.name,
        description: (product as any).description ?? null,
        salePrice: product.salePrice !== null ? Number(product.salePrice) : null,
        status: product.status as 'DRAFT' | 'ACTIVE' | 'INACTIVE',
      });

      const token = await this.authService.getAccessToken(organizationId);

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
