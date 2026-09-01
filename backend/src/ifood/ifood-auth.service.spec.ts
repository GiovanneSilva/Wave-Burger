import { IfoodAuthService } from './ifood-auth.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

describe('IfoodAuthService (fluxo Distribuído)', () => {
  let service: IfoodAuthService;
  let configService: { get: jest.Mock };
  let prisma: any;
  const originalFetch = global.fetch;
  const ORG_ID = 'org-1';

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          IFOOD_CLIENT_ID: 'client-123',
          IFOOD_CLIENT_SECRET: 'secret-456',
        };
        return values[key] ?? fallback;
      }),
    };
    prisma = {
      ifoodCredential: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new IfoodAuthService(
      configService as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('requestUserCode — Passo 1', () => {
    it('solicita o código e guarda o verifier internamente', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          userCode: 'ABC-123',
          authorizationCodeVerifier: 'verifier-xyz',
          verificationUrl: 'https://ifood.com/authorize',
          verificationUrlComplete: 'https://ifood.com/authorize?code=ABC-123',
          expiresIn: 600,
        }),
      });

      const result = await service.requestUserCode(ORG_ID);

      expect(result).toEqual({
        userCode: 'ABC-123',
        verificationUrl: 'https://ifood.com/authorize',
        verificationUrlComplete: 'https://ifood.com/authorize?code=ABC-123',
        expiresInSeconds: 600,
      });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/authentication/v1.0/oauth/userCode'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('REJEITA quando as credenciais não estão configuradas', async () => {
      configService.get.mockImplementation((_key: string, fallback?: string) => fallback);

      await expect(service.requestUserCode(ORG_ID)).rejects.toThrow(
        'Credenciais do iFood não configuradas',
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('exchangeAuthorizationCode — Passo 2', () => {
    async function requestCodeFirst() {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userCode: 'ABC-123',
          authorizationCodeVerifier: 'verifier-xyz',
          verificationUrl: 'https://ifood.com/authorize',
          verificationUrlComplete: 'https://ifood.com/authorize?code=ABC-123',
          expiresIn: 600,
        }),
      });
      await service.requestUserCode(ORG_ID);
    }

    it('troca o código pelo token e PERSISTE o refresh_token no banco', async () => {
      await requestCodeFirst();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: 'access-abc',
          refreshToken: 'refresh-abc',
          expiresIn: 21600,
        }),
      });

      await service.exchangeAuthorizationCode(ORG_ID, 'LHQX-ZZZZ');

      expect(prisma.ifoodCredential.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: ORG_ID },
          create: expect.objectContaining({
            refreshToken: 'refresh-abc',
            accessToken: 'access-abc',
          }),
        }),
      );

      // usa o verifier certo na troca
      const tokenCall = (global.fetch as jest.Mock).mock.calls[1];
      const sentBody = tokenCall[1].body as URLSearchParams;
      expect(sentBody.get('authorizationCodeVerifier')).toBe('verifier-xyz');
      expect(sentBody.get('grantType')).toBe('authorization_code');
    });

    it('REJEITA se não houver solicitação de código pendente (Passo 1 nunca chamado)', async () => {
      await expect(service.exchangeAuthorizationCode(ORG_ID, 'algum-codigo')).rejects.toThrow(
        'Nenhuma solicitação de código pendente',
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('getAccessToken — uso do dia a dia', () => {
    it('REJEITA quando a organização nunca completou a autorização (Fase 0 pendente)', async () => {
      prisma.ifoodCredential.findUnique.mockResolvedValue(null);

      await expect(service.getAccessToken(ORG_ID)).rejects.toThrow(
        'Nenhuma autorização do iFood encontrada',
      );
    });

    it('reutiliza o accessToken salvo no banco quando ainda válido', async () => {
      prisma.ifoodCredential.findUnique.mockResolvedValue({
        refreshToken: 'refresh-abc',
        accessToken: 'access-cached',
        accessTokenExpiresAt: new Date(Date.now() + 3600_000),
      });

      const token = await service.getAccessToken(ORG_ID);

      expect(token).toBe('access-cached');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('renova via refresh_token quando o accessToken salvo expirou', async () => {
      prisma.ifoodCredential.findUnique.mockResolvedValue({
        refreshToken: 'refresh-abc',
        accessToken: 'access-velho',
        accessTokenExpiresAt: new Date(Date.now() - 1000), // já expirado
      });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ accessToken: 'access-novo', expiresIn: 21600 }),
      });

      const token = await service.getAccessToken(ORG_ID);

      expect(token).toBe('access-novo');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/authentication/v1.0/oauth/token'),
        expect.objectContaining({ method: 'POST' }),
      );
      const sentBody = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams;
      expect(sentBody.get('grantType')).toBe('refresh_token');
      expect(sentBody.get('refreshToken')).toBe('refresh-abc');
      expect(prisma.ifoodCredential.update).toHaveBeenCalled();
    });

    it('mantém o refresh_token antigo se o iFood não devolver um novo na renovação', async () => {
      prisma.ifoodCredential.findUnique.mockResolvedValue({
        refreshToken: 'refresh-antigo',
        accessToken: null,
        accessTokenExpiresAt: null,
      });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ accessToken: 'access-novo', expiresIn: 21600 }), // sem refreshToken novo
      });

      await service.getAccessToken(ORG_ID);

      expect(prisma.ifoodCredential.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ refreshToken: 'refresh-antigo' }),
        }),
      );
    });

    it('REJEITA quando a renovação falha', async () => {
      prisma.ifoodCredential.findUnique.mockResolvedValue({
        refreshToken: 'refresh-abc',
        accessToken: null,
        accessTokenExpiresAt: null,
      });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'invalid_grant',
      });

      await expect(service.getAccessToken(ORG_ID)).rejects.toThrow(
        'Falha ao renovar o token do iFood',
      );
    });
  });

  describe('clearCache', () => {
    it('força nova busca no banco na próxima chamada', async () => {
      prisma.ifoodCredential.findUnique.mockResolvedValue({
        refreshToken: 'refresh-abc',
        accessToken: 'access-cached',
        accessTokenExpiresAt: new Date(Date.now() + 3600_000),
      });

      await service.getAccessToken(ORG_ID);
      service.clearCache();
      await service.getAccessToken(ORG_ID);

      expect(prisma.ifoodCredential.findUnique).toHaveBeenCalledTimes(2);
    });
  });
});
