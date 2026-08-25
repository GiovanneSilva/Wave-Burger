import { IfoodAuthService } from './ifood-auth.service';
import { ConfigService } from '@nestjs/config';

describe('IfoodAuthService', () => {
  let service: IfoodAuthService;
  let configService: { get: jest.Mock };
  const originalFetch = global.fetch;

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
    service = new IfoodAuthService(configService as unknown as ConfigService);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('obtém um novo token na primeira chamada', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'token-abc', expiresIn: 3600 }),
    });

    const token = await service.getAccessToken();

    expect(token).toBe('token-abc');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/authentication/v1.0/oauth/token'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('reutiliza o token em cache em vez de pedir um novo (dentro da validade)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'token-abc', expiresIn: 3600 }),
    });

    await service.getAccessToken();
    await service.getAccessToken();
    await service.getAccessToken();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('pede um novo token quando o cache expirou', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'token-curto', expiresIn: 1 }), // expira em 1s
    });

    await service.getAccessToken();

    // avança o relógio manualmente além da expiração + margem de segurança
    jest.useFakeTimers().setSystemTime(Date.now() + 60_000);
    await service.getAccessToken();
    jest.useRealTimers();

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('REJEITA quando as credenciais não estão configuradas', async () => {
    configService.get.mockImplementation((_key: string, fallback?: string) => fallback);

    await expect(service.getAccessToken()).rejects.toThrow('Credenciais do iFood não configuradas');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('REJEITA quando o iFood responde com erro', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'invalid_client',
    });

    await expect(service.getAccessToken()).rejects.toThrow(
      'Falha ao autenticar com o iFood (status 401)',
    );
  });

  it('clearCache() força obtenção de um novo token na próxima chamada', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'token-abc', expiresIn: 3600 }),
    });

    await service.getAccessToken();
    service.clearCache();
    await service.getAccessToken();

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
