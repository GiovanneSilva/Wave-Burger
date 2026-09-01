import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

interface CachedAccessToken {
  organizationId: string;
  token: string;
  expiresAt: number;
}

export interface UserCodeResult {
  userCode: string;
  verificationUrl: string;
  verificationUrlComplete: string;
  expiresInSeconds: number;
}

const SAFETY_MARGIN_MS = 30_000;
const DEFAULT_TOKEN_TTL_SECONDS = 21_600; // 6h, conforme documentação do iFood

/// Integração iFood (Fase 0/1, ver claude/ifood-integration-plan.md).
///
/// Implementa o fluxo de **aplicativo Distribuído** — diferente do
/// fluxo Centralizado (`client_credentials`, mais simples, sem
/// intervenção humana), o Distribuído exige uma autorização MANUAL,
/// uma única vez, feita pelo dono da loja no Portal do Parceiro do
/// iFood:
///
///   1. `requestUserCode()` — pede um código; o iFood devolve um
///      `userCode` + link para o usuário acessar e autorizar.
///   2. O usuário acessa o link, faz login no Portal do Parceiro,
///      autoriza o app, e recebe um `authorizationCode`.
///   3. `exchangeAuthorizationCode()` — troca esse código por um
///      token de acesso + `refresh_token`, e PERSISTE o
///      `refresh_token` no banco (`IfoodCredential`) — a partir daqui,
///      a renovação é automática, sem repetir o passo manual.
///   4. `getAccessToken()` — uso do dia a dia: retorna um token válido,
///      renovando via `refresh_token` quando necessário.
@Injectable()
export class IfoodAuthService {
  private readonly logger = new Logger(IfoodAuthService.name);
  private cachedAccessToken: CachedAccessToken | null = null;
  /// authorizationCodeVerifier é de vida curta (poucos minutos, entre
  /// pedir o código e o usuário autorizar) — memória é suficiente, não
  /// precisa sobreviver a reinício do processo.
  private readonly pendingVerifiers = new Map<string, string>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private get baseUrl(): string {
    return this.configService.get<string>(
      'IFOOD_API_BASE_URL',
      'https://merchant-api.ifood.com.br',
    );
  }

  private getClientCredentials(): { clientId: string; clientSecret: string } {
    const clientId = this.configService.get<string>('IFOOD_CLIENT_ID');
    const clientSecret = this.configService.get<string>('IFOOD_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error(
        'Credenciais do iFood não configuradas (IFOOD_CLIENT_ID/IFOOD_CLIENT_SECRET). ' +
          'Complete o cadastro no Portal Developer do iFood primeiro (Fase 0 do plano de integração).',
      );
    }

    return { clientId, clientSecret };
  }

  /// Passo 1 do fluxo Distribuído.
  async requestUserCode(organizationId: string): Promise<UserCodeResult> {
    const { clientId } = this.getClientCredentials();
    const body = new URLSearchParams({ clientId });

    const res = await fetch(`${this.baseUrl}/authentication/v1.0/oauth/userCode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Falha ao solicitar código do iFood: ${res.status} ${text}`);
      throw new Error(`Falha ao solicitar código de autorização do iFood (status ${res.status}).`);
    }

    const data = await res.json();
    this.pendingVerifiers.set(organizationId, data.authorizationCodeVerifier);

    return {
      userCode: data.userCode,
      verificationUrl: data.verificationUrl,
      verificationUrlComplete: data.verificationUrlComplete,
      expiresInSeconds: Number(data.expiresIn ?? 600),
    };
  }

  /// Passo 2 do fluxo Distribuído — troca o `authorizationCode` (que o
  /// usuário colou depois de autorizar no Portal) pelo token de acesso
  /// + refresh_token, e persiste o refresh_token.
  async exchangeAuthorizationCode(
    organizationId: string,
    authorizationCode: string,
  ): Promise<void> {
    const verifier = this.pendingVerifiers.get(organizationId);
    if (!verifier) {
      throw new Error(
        'Nenhuma solicitação de código pendente para esta loja. Clique em "Solicitar código" novamente antes de confirmar a autorização.',
      );
    }

    const { clientId, clientSecret } = this.getClientCredentials();
    const body = new URLSearchParams({
      grantType: 'authorization_code',
      clientId,
      clientSecret,
      authorizationCode,
      authorizationCodeVerifier: verifier,
    });

    const res = await fetch(`${this.baseUrl}/authentication/v1.0/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Falha ao trocar código de autorização do iFood: ${res.status} ${text}`);
      throw new Error(`Falha ao confirmar a autorização com o iFood (status ${res.status}).`);
    }

    const data = await res.json();
    const expiresInSeconds = Number(data.expiresIn ?? DEFAULT_TOKEN_TTL_SECONDS);
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    await this.prisma.ifoodCredential.upsert({
      where: { organizationId },
      create: {
        organizationId,
        refreshToken: data.refreshToken,
        accessToken: data.accessToken,
        accessTokenExpiresAt: expiresAt,
      },
      update: {
        refreshToken: data.refreshToken,
        accessToken: data.accessToken,
        accessTokenExpiresAt: expiresAt,
      },
    });

    this.pendingVerifiers.delete(organizationId);
    this.cachedAccessToken = {
      organizationId,
      token: data.accessToken,
      expiresAt: expiresAt.getTime(),
    };
  }

  /// Uso do dia a dia — retorna um token de acesso válido para a
  /// organização, renovando via refresh_token quando necessário.
  async getAccessToken(organizationId: string): Promise<string> {
    if (
      this.cachedAccessToken &&
      this.cachedAccessToken.organizationId === organizationId &&
      this.cachedAccessToken.expiresAt > Date.now() + SAFETY_MARGIN_MS
    ) {
      return this.cachedAccessToken.token;
    }

    const credential = await this.prisma.ifoodCredential.findUnique({ where: { organizationId } });

    if (!credential) {
      throw new Error(
        'Nenhuma autorização do iFood encontrada para esta loja. Complete a autorização em ' +
          'Configurações → Integração iFood antes de sincronizar.',
      );
    }

    if (
      credential.accessToken &&
      credential.accessTokenExpiresAt &&
      credential.accessTokenExpiresAt.getTime() > Date.now() + SAFETY_MARGIN_MS
    ) {
      this.cachedAccessToken = {
        organizationId,
        token: credential.accessToken,
        expiresAt: credential.accessTokenExpiresAt.getTime(),
      };
      return credential.accessToken;
    }

    return this.refreshAccessToken(organizationId, credential.refreshToken);
  }

  private async refreshAccessToken(organizationId: string, refreshToken: string): Promise<string> {
    const { clientId, clientSecret } = this.getClientCredentials();
    const body = new URLSearchParams({
      grantType: 'refresh_token',
      clientId,
      clientSecret,
      refreshToken,
    });

    const res = await fetch(`${this.baseUrl}/authentication/v1.0/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Falha ao renovar token do iFood: ${res.status} ${text}`);
      throw new Error(
        `Falha ao renovar o token do iFood (status ${res.status}). Pode ser necessário autorizar novamente em Configurações.`,
      );
    }

    const data = await res.json();
    const expiresInSeconds = Number(data.expiresIn ?? DEFAULT_TOKEN_TTL_SECONDS);
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    // O iFood pode ou não rotacionar o refresh_token a cada renovação —
    // se não vier um novo, mantém o mesmo.
    const newRefreshToken = data.refreshToken ?? refreshToken;

    await this.prisma.ifoodCredential.update({
      where: { organizationId },
      data: {
        refreshToken: newRefreshToken,
        accessToken: data.accessToken,
        accessTokenExpiresAt: expiresAt,
      },
    });

    this.cachedAccessToken = {
      organizationId,
      token: data.accessToken,
      expiresAt: expiresAt.getTime(),
    };
    return data.accessToken;
  }

  /// Força a releitura do banco na próxima chamada — útil se o iFood
  /// recusar um token que achávamos válido (ex.: revogado do lado deles).
  clearCache(): void {
    this.cachedAccessToken = null;
  }
}
