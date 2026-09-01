import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

/// Integração iFood (Fase 0/1, ver claude/ifood-integration-plan.md).
/// Gerencia o token OAuth da Merchant-API do iFood — obtém e cacheia em
/// memória, renovando automaticamente ~30s antes de expirar (margem de
/// segurança contra latência de rede).
///
/// Credenciais vêm de variáveis de ambiente (IFOOD_CLIENT_ID/
/// IFOOD_CLIENT_SECRET). A Fase 0 (cadastro no Portal Developer, com
/// CNPJ real) é responsabilidade do usuário — este serviço só funciona
/// depois que essas variáveis existirem de verdade.
@Injectable()
export class IfoodAuthService {
  private readonly logger = new Logger(IfoodAuthService.name);
  private cachedToken: CachedToken | null = null;

  constructor(private readonly configService: ConfigService) {}

  private get baseUrl(): string {
    return this.configService.get<string>(
      'IFOOD_API_BASE_URL',
      'https://merchant-api.ifood.com.br',
    );
  }

  async getAccessToken(): Promise<string> {
    const SAFETY_MARGIN_MS = 30_000;
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + SAFETY_MARGIN_MS) {
      return this.cachedToken.accessToken;
    }
    return this.fetchNewToken();
  }

  private async fetchNewToken(): Promise<string> {
    const clientId = this.configService.get<string>('IFOOD_CLIENT_ID');
    const clientSecret = this.configService.get<string>('IFOOD_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error(
        'Credenciais do iFood não configuradas (IFOOD_CLIENT_ID/IFOOD_CLIENT_SECRET). ' +
          'Complete o cadastro no Portal Developer do iFood primeiro (Fase 0 do plano de integração).',
      );
    }

    const body = new URLSearchParams({
      grantType: 'client_credentials',
      clientId,
      clientSecret,
    });

    const res = await fetch(`${this.baseUrl}/authentication/v1.0/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Falha ao obter token do iFood: ${res.status} ${text}`);
      throw new Error(`Falha ao autenticar com o iFood (status ${res.status}).`);
    }

    const data = await res.json();
    const expiresInSeconds = Number(data.expiresIn ?? 3600);

    this.cachedToken = {
      accessToken: data.accessToken,
      expiresAt: Date.now() + expiresInSeconds * 1000,
    };

    return this.cachedToken.accessToken;
  }

  /// Força renovação na próxima chamada — útil se o iFood recusar um
  /// token que achávamos válido (ex.: revogado do lado deles).
  clearCache(): void {
    this.cachedToken = null;
  }
}
