import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { IfoodAuthService } from './ifood-auth.service';
import { AnalyticsService } from '../analytics/analytics.service';

export interface InventorySyncResult {
  productId: string;
  productName: string;
  quantity: number;
  success: boolean;
  error?: string;
}

const INVENTORY_SYNC_INTERVAL_MS = 5 * 60_000; // 5 minutos

/// Integração iFood — Fase 3 do plano (ver
/// claude/ifood-integration-plan.md). Empurra "quanto dá pra entregar
/// hoje" (já calculado pela Etapa de BI/Indicadores, reaproveitado
/// aqui sem duplicar cálculo nenhum) pro campo de inventário do
/// Catalog do iFood — quando a quantidade chega a 0, o iFood pausa o
/// item automaticamente (`AVAILABLE` → `UNAVAILABLE`), sem precisar de
/// nenhuma ação manual da nossa parte.
///
/// Rodando a cada 5 minutos (intervalo, não em tempo real a cada
/// venda/compra) — decisão de escopo para esta primeira entrega, para
/// não precisar conectar em todos os pontos que alteram estoque
/// (venda manual, venda do iFood, compra confirmada, ajuste manual).
/// Se precisar de reação mais rápida, isso pode evoluir para
/// disparado por evento no lugar de (ou além) do intervalo.
@Injectable()
export class IfoodInventorySyncService {
  private readonly logger = new Logger(IfoodInventorySyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: IfoodAuthService,
    private readonly analyticsService: AnalyticsService,
    private readonly configService: ConfigService,
  ) {}

  private get baseUrl(): string {
    return this.configService.get<string>(
      'IFOOD_API_BASE_URL',
      'https://merchant-api.ifood.com.br',
    );
  }

  @Interval(INVENTORY_SYNC_INTERVAL_MS)
  async handleInventorySync(): Promise<void> {
    try {
      await this.syncAllBusinessUnits();
    } catch (err: any) {
      this.logger.error(`Falha inesperada na sincronização de inventário do iFood: ${err.message}`);
    }
  }

  async syncAllBusinessUnits(): Promise<void> {
    const businessUnits = await this.prisma.businessUnit.findMany({
      where: { ifoodMerchantId: { not: null } },
    });

    for (const businessUnit of businessUnits) {
      await this.syncInventory(
        businessUnit.id,
        businessUnit.organizationId,
        (businessUnit as any).ifoodMerchantId as string,
      );
    }
  }

  /// Sincroniza o inventário de todos os produtos ativos de uma
  /// unidade de negócio. Cada produto é enviado individualmente — uma
  /// falha num produto não impede os demais de serem sincronizados.
  async syncInventory(
    businessUnitId: string,
    organizationId: string,
    merchantId: string,
  ): Promise<InventorySyncResult[]> {
    const deliverableQuantities = await this.analyticsService.getDeliverableQuantities(
      businessUnitId,
      organizationId,
    );

    const token = await this.authService.getAccessToken();
    const results: InventorySyncResult[] = [];

    for (const dq of deliverableQuantities) {
      results.push(
        await this.pushInventory(
          merchantId,
          dq.productId,
          dq.productName,
          dq.deliverableQuantity,
          token,
        ),
      );
    }

    return results;
  }

  private async pushInventory(
    merchantId: string,
    productId: string,
    productName: string,
    quantity: number,
    token: string,
  ): Promise<InventorySyncResult> {
    try {
      // Correção de 04/09/2026: o campo real esperado pelo iFood é
      // `amount` (inteiro), não `quantity` — confirmado pelo erro real
      // "PostInventoryItemDTO.amount should not be empty / must be an
      // integer number". A documentação tinha uma divergência entre
      // duas páginas (uma citava `quantity`); o teste real resolveu.
      // `Math.trunc` garante inteiro mesmo que `deliverableQuantity`
      // já venha arredondado do calculador (Math.floor).
      const res = await fetch(`${this.baseUrl}/catalog/v2.0/merchants/${merchantId}/inventory`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, amount: Math.trunc(quantity) }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`iFood respondeu ${res.status}: ${text}`);
      }

      return { productId, productName, quantity, success: true };
    } catch (err: any) {
      this.logger.error(
        `Falha ao sincronizar inventário do produto "${productName}" (${quantity} un.) com o iFood: ${err.message}`,
      );
      return { productId, productName, quantity, success: false, error: err.message };
    }
  }
}
