import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { IfoodAuthService } from './ifood-auth.service';
import { SalesService } from '../sales/sales.service';

export interface IfoodEvent {
  id: string;
  code: string;
  fullCode: string;
  orderId: string;
  merchantId: string;
  createdAt: string;
}

export interface IfoodOrderItem {
  externalCode: string;
  quantity: number;
  unitPrice: number;
}

export interface IfoodOrderDetails {
  id: string;
  items: IfoodOrderItem[];
}

const POLLING_INTERVAL_MS = 30_000;

/// Integração iFood — Fase 2 do plano (ver
/// claude/ifood-integration-plan.md). O núcleo do "puxar
/// automaticamente": a cada 30s, consulta novos eventos de pedido; ao
/// receber um `PLACED`, busca o detalhe do pedido, registra uma
/// `Sale` por item (reaproveitando 100% de `SalesService.registerSale`
/// — mesma lógica de BR-009/PD-001 já testada desde a Etapa 16, sem
/// duplicar cálculo nenhum), e confirma o pedido automaticamente.
///
/// Escopo desta primeira entrega: só o evento `PLACED` é processado de
/// verdade. Os demais (`CONFIRMED`, `SEPARATION_STARTED`, etc.) são
/// apenas reconhecidos (`acknowledgment`), sem ação — rastreamento
/// completo do ciclo de vida do pedido fica para uma fase futura, se
/// solicitado.
@Injectable()
export class IfoodOrderPollingService {
  private readonly logger = new Logger(IfoodOrderPollingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: IfoodAuthService,
    private readonly salesService: SalesService,
    private readonly configService: ConfigService,
  ) {}

  private get baseUrl(): string {
    return this.configService.get<string>(
      'IFOOD_API_BASE_URL',
      'https://merchant-api.ifood.com.br',
    );
  }

  @Interval(POLLING_INTERVAL_MS)
  async handlePolling(): Promise<void> {
    try {
      await this.pollAllBusinessUnits();
    } catch (err: any) {
      this.logger.error(`Falha inesperada no polling de eventos do iFood: ${err.message}`);
    }
  }

  async pollAllBusinessUnits(): Promise<void> {
    const businessUnits = await this.prisma.businessUnit.findMany({
      where: { ifoodMerchantId: { not: null } },
    });

    if (businessUnits.length === 0) {
      return; // nenhuma loja configurada para iFood ainda (Fase 0 pendente ou merchantId não salvo)
    }

    const token = await this.authService.getAccessToken();
    const merchantIds = businessUnits.map((bu: any) => bu.ifoodMerchantId as string);
    const merchantToBusinessUnit = new Map<string, { id: string; organizationId: string }>(
      businessUnits.map((bu: any) => [
        bu.ifoodMerchantId as string,
        { id: bu.id, organizationId: bu.organizationId },
      ]),
    );

    const events = await this.fetchEvents(merchantIds, token);
    if (events.length === 0) {
      return;
    }

    for (const event of events) {
      if (event.fullCode === 'PLACED') {
        const businessUnit = merchantToBusinessUnit.get(event.merchantId);
        if (businessUnit) {
          await this.processPlacedOrder(event.orderId, businessUnit, token);
        } else {
          this.logger.warn(`Evento PLACED para merchant desconhecido: ${event.merchantId}`);
        }
      }
    }

    await this.acknowledgeEvents(events, token);
  }

  private async fetchEvents(merchantIds: string[], token: string): Promise<IfoodEvent[]> {
    const res = await fetch(`${this.baseUrl}/events/v1.0/events:polling`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-polling-merchants': merchantIds.join(','),
      },
    });

    if (res.status === 204) {
      return [];
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Falha ao consultar eventos do iFood (status ${res.status}): ${text}`);
    }

    return res.json();
  }

  private async acknowledgeEvents(events: IfoodEvent[], token: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/events/v1.0/events/acknowledgment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(events.map((e) => ({ id: e.id }))),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(
        `Falha ao confirmar recebimento de eventos do iFood (status ${res.status}): ${text}`,
      );
    }
  }

  private async processPlacedOrder(
    orderId: string,
    businessUnit: { id: string; organizationId: string },
    token: string,
  ): Promise<void> {
    // Idempotência: o iFood pode reenviar o mesmo evento mais de uma
    // vez (documentado oficialmente) — se já existe venda com este
    // externalOrderId, o pedido já foi processado antes.
    const alreadyProcessed = await this.prisma.sale.findFirst({
      where: { externalOrderId: orderId },
    });
    if (alreadyProcessed) {
      return;
    }

    try {
      const order = await this.fetchOrderDetails(orderId, token);

      // `soldByUserId` exige um usuário real (FK) — ainda não existe um
      // conceito de "usuário de sistema" dedicado no projeto. Escolha
      // pragmática por ora: atribui à venda automática o usuário mais
      // antigo da organização (tipicamente o admin cadastrado na
      // Etapa 6). Revisar se/quando um usuário de sistema for criado.
      const systemActor = await this.prisma.user.findFirst({
        where: { organizationId: businessUnit.organizationId },
        orderBy: { createdAt: 'asc' },
      });

      if (!systemActor) {
        this.logger.error(
          `Pedido ${orderId} do iFood não pôde ser processado: nenhum usuário encontrado na organização para atribuir a venda.`,
        );
        return;
      }

      for (const item of order.items) {
        const product = await this.prisma.product.findFirst({
          where: { id: item.externalCode, organizationId: businessUnit.organizationId },
        });

        if (!product) {
          this.logger.error(
            `Pedido ${orderId} do iFood tem item sem produto correspondente ` +
              `(externalCode "${item.externalCode}") — venda não registrada para este item.`,
          );
          continue;
        }

        await this.salesService.registerSale(
          {
            businessUnitId: businessUnit.id,
            productId: product.id,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
          } as any,
          { id: systemActor.id, organizationId: businessUnit.organizationId },
          { origin: 'IFOOD', externalOrderId: orderId },
        );
      }

      await this.confirmOrder(orderId, token);
    } catch (err: any) {
      this.logger.error(`Falha ao processar pedido ${orderId} do iFood: ${err.message}`);
    }
  }

  private async fetchOrderDetails(orderId: string, token: string): Promise<IfoodOrderDetails> {
    const res = await fetch(`${this.baseUrl}/order/v1.0/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Falha ao buscar detalhes do pedido ${orderId} (status ${res.status}): ${text}`,
      );
    }

    return res.json();
  }

  private async confirmOrder(orderId: string, token: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/order/v1.0/orders/${orderId}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(
        `Falha ao confirmar pedido ${orderId} no iFood (status ${res.status}): ${text}`,
      );
    }
  }
}
