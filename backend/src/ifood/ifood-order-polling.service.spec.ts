import { IfoodOrderPollingService } from './ifood-order-polling.service';
import { PrismaService } from '../prisma/prisma.service';
import { IfoodAuthService } from './ifood-auth.service';
import { SalesService } from '../sales/sales.service';
import { ConfigService } from '@nestjs/config';

describe('IfoodOrderPollingService', () => {
  let service: IfoodOrderPollingService;
  let prisma: any;
  let authService: { getAccessToken: jest.Mock };
  let salesService: { registerSale: jest.Mock };
  let configService: { get: jest.Mock };
  const originalFetch = global.fetch;

  const BUSINESS_UNIT = { id: 'bu-1', organizationId: 'org-1', ifoodMerchantId: 'merchant-1' };
  const USER = { id: 'user-1', organizationId: 'org-1', createdAt: new Date('2026-01-01') };

  beforeEach(() => {
    prisma = {
      businessUnit: { findMany: jest.fn() },
      sale: { findFirst: jest.fn() },
      product: { findFirst: jest.fn() },
      user: { findFirst: jest.fn() },
    };
    authService = { getAccessToken: jest.fn().mockResolvedValue('token-abc') };
    salesService = { registerSale: jest.fn().mockResolvedValue({}) };
    configService = { get: jest.fn((_key: string, fallback?: string) => fallback) };
    global.fetch = jest.fn();

    service = new IfoodOrderPollingService(
      prisma as unknown as PrismaService,
      authService as unknown as IfoodAuthService,
      salesService as unknown as SalesService,
      configService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetchSequence(...responses: Array<{ ok: boolean; status?: number; body?: any }>) {
    const impl = jest.fn();
    for (const r of responses) {
      impl.mockResolvedValueOnce({
        ok: r.ok,
        status: r.status,
        json: async () => r.body,
        text: async () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? '')),
      });
    }
    global.fetch = impl;
    return impl;
  }

  it('não faz nenhuma chamada quando nenhuma loja tem ifoodMerchantId configurado', async () => {
    prisma.businessUnit.findMany.mockResolvedValue([]);

    await service.pollAllBusinessUnits();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(authService.getAccessToken).not.toHaveBeenCalled();
  });

  it('quando o polling retorna 204 (sem eventos), não tenta confirmar nada', async () => {
    prisma.businessUnit.findMany.mockResolvedValue([BUSINESS_UNIT]);
    const fetchMock = mockFetchSequence({ ok: true, status: 204 });

    await service.pollAllBusinessUnits();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('EXEMPLO COMPLETO: processa um evento PLACED — registra a venda e confirma o pedido', async () => {
    prisma.businessUnit.findMany.mockResolvedValue([BUSINESS_UNIT]);
    prisma.sale.findFirst.mockResolvedValue(null); // ainda não processado
    prisma.user.findFirst.mockResolvedValue(USER);
    prisma.product.findFirst.mockResolvedValue({ id: 'prod-1', name: 'Smash Burger' });

    const fetchMock = mockFetchSequence(
      {
        ok: true,
        body: [
          {
            id: 'event-1',
            code: 'PLC',
            fullCode: 'PLACED',
            orderId: 'order-1',
            merchantId: 'merchant-1',
            createdAt: '2026-09-02T10:00:00Z',
          },
        ],
      }, // GET events:polling
      {
        ok: true,
        body: {
          id: 'order-1',
          items: [
            { externalCode: '11111111-1111-1111-1111-111111111111', quantity: 2, unitPrice: 28.9 },
          ],
        },
      }, // GET order details
      { ok: true, body: {} }, // POST confirm
      { ok: true, body: {} }, // POST acknowledgment
    );

    await service.pollAllBusinessUnits();

    expect(fetchMock).toHaveBeenCalledTimes(4);

    // registrou a venda com origem IFOOD e o externalOrderId certo
    expect(salesService.registerSale).toHaveBeenCalledWith(
      expect.objectContaining({
        businessUnitId: 'bu-1',
        productId: 'prod-1',
        quantity: '2',
        unitPrice: '28.9',
      }),
      { id: 'user-1', organizationId: 'org-1' },
      { origin: 'IFOOD', externalOrderId: 'order-1' },
    );

    // confirmou o pedido
    const confirmCall = fetchMock.mock.calls[2];
    expect(confirmCall[0]).toContain('/order/v1.0/orders/order-1/confirm');
    expect(confirmCall[1].method).toBe('POST');

    // confirmou o recebimento do evento
    const ackCall = fetchMock.mock.calls[3];
    expect(ackCall[0]).toContain('/events/acknowledgment');
    const ackBody = JSON.parse(ackCall[1].body);
    expect(ackBody).toEqual([{ id: 'event-1' }]);
  });

  it('IDEMPOTÊNCIA: não reprocessa um pedido cujo externalOrderId já tem venda registrada', async () => {
    prisma.businessUnit.findMany.mockResolvedValue([BUSINESS_UNIT]);
    prisma.sale.findFirst.mockResolvedValue({ id: 'sale-ja-existe' }); // já processado

    const fetchMock = mockFetchSequence(
      {
        ok: true,
        body: [
          {
            id: 'event-1',
            code: 'PLC',
            fullCode: 'PLACED',
            orderId: 'order-1',
            merchantId: 'merchant-1',
            createdAt: '2026-09-02T10:00:00Z',
          },
        ],
      },
      { ok: true, body: {} }, // POST acknowledgment (ainda reconhece o evento)
    );

    await service.pollAllBusinessUnits();

    expect(salesService.registerSale).not.toHaveBeenCalled();
    // não buscou detalhe do pedido nem confirmou — só polling + acknowledgment
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ignora evento PLACED de um merchant desconhecido (não configurado em nenhuma loja)', async () => {
    prisma.businessUnit.findMany.mockResolvedValue([BUSINESS_UNIT]);

    mockFetchSequence(
      {
        ok: true,
        body: [
          {
            id: 'event-1',
            code: 'PLC',
            fullCode: 'PLACED',
            orderId: 'order-1',
            merchantId: 'merchant-desconhecido',
            createdAt: '2026-09-02T10:00:00Z',
          },
        ],
      },
      { ok: true, body: {} },
    );

    await service.pollAllBusinessUnits();

    expect(salesService.registerSale).not.toHaveBeenCalled();
    expect(prisma.sale.findFirst).not.toHaveBeenCalled();
  });

  it('eventos que não são PLACED só são reconhecidos, sem processar venda', async () => {
    prisma.businessUnit.findMany.mockResolvedValue([BUSINESS_UNIT]);

    mockFetchSequence(
      {
        ok: true,
        body: [
          {
            id: 'event-1',
            code: 'CFM',
            fullCode: 'CONFIRMED',
            orderId: 'order-1',
            merchantId: 'merchant-1',
            createdAt: '2026-09-02T10:00:00Z',
          },
        ],
      },
      { ok: true, body: {} },
    );

    await service.pollAllBusinessUnits();

    expect(salesService.registerSale).not.toHaveBeenCalled();
    expect(prisma.sale.findFirst).not.toHaveBeenCalled();
  });

  it('CORREÇÃO REAL: item com externalCode que não é UUID válido é pulado sem consultar o banco (evita o erro do Prisma)', async () => {
    prisma.businessUnit.findMany.mockResolvedValue([BUSINESS_UNIT]);
    prisma.sale.findFirst.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(USER);
    // segundo item tem UUID válido — precisa continuar sendo processado
    // normalmente mesmo depois do primeiro item malformado
    prisma.product.findFirst.mockResolvedValue({
      id: '44444444-4444-4444-4444-444444444444',
      name: 'Fritas',
    });

    mockFetchSequence(
      {
        ok: true,
        body: [
          {
            id: 'event-1',
            code: 'PLC',
            fullCode: 'PLACED',
            orderId: 'order-1',
            merchantId: 'merchant-1',
            createdAt: '2026-09-02T10:00:00Z',
          },
        ],
      },
      {
        ok: true,
        body: {
          id: 'order-1',
          items: [
            // reproduz exatamente o erro real reportado pelo usuário:
            // "Error creating UUID, invalid length: expected length 32
            // for simple format, found 4" — item de exemplo da loja de
            // teste do iFood, nunca sincronizado pelo Wave Burger
            { externalCode: '1a2b', quantity: 1, unitPrice: 10 },
            { externalCode: '44444444-4444-4444-4444-444444444444', quantity: 1, unitPrice: 8 },
          ],
        },
      },
      { ok: true, body: {} }, // confirm
      { ok: true, body: {} }, // acknowledgment
    );

    await service.pollAllBusinessUnits();

    // NUNCA tentou consultar o banco com o externalCode malformado —
    // só foi chamado 1 vez, para o item com UUID válido
    expect(prisma.product.findFirst).toHaveBeenCalledTimes(1);
    expect(salesService.registerSale).toHaveBeenCalledTimes(1);
    expect(salesService.registerSale).toHaveBeenCalledWith(
      expect.objectContaining({ productId: '44444444-4444-4444-4444-444444444444' }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('item sem produto correspondente (externalCode não encontrado) é pulado, mas não trava o resto', async () => {
    prisma.businessUnit.findMany.mockResolvedValue([BUSINESS_UNIT]);
    prisma.sale.findFirst.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(USER);
    prisma.product.findFirst
      .mockResolvedValueOnce(null) // primeiro item: não encontrado
      .mockResolvedValueOnce({ id: 'prod-2', name: 'Fritas' }); // segundo item: encontrado

    mockFetchSequence(
      {
        ok: true,
        body: [
          {
            id: 'event-1',
            code: 'PLC',
            fullCode: 'PLACED',
            orderId: 'order-1',
            merchantId: 'merchant-1',
            createdAt: '2026-09-02T10:00:00Z',
          },
        ],
      },
      {
        ok: true,
        body: {
          id: 'order-1',
          items: [
            { externalCode: '22222222-2222-2222-2222-222222222222', quantity: 1, unitPrice: 10 },
            { externalCode: '33333333-3333-3333-3333-333333333333', quantity: 1, unitPrice: 8 },
          ],
        },
      },
      { ok: true, body: {} }, // confirm
      { ok: true, body: {} }, // acknowledgment
    );

    await service.pollAllBusinessUnits();

    // só registrou a venda do item que tinha produto correspondente
    expect(salesService.registerSale).toHaveBeenCalledTimes(1);
    expect(salesService.registerSale).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'prod-2' }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('não registra nada quando não há nenhum usuário na organização para atribuir a venda', async () => {
    prisma.businessUnit.findMany.mockResolvedValue([BUSINESS_UNIT]);
    prisma.sale.findFirst.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);

    mockFetchSequence(
      {
        ok: true,
        body: [
          {
            id: 'event-1',
            code: 'PLC',
            fullCode: 'PLACED',
            orderId: 'order-1',
            merchantId: 'merchant-1',
            createdAt: '2026-09-02T10:00:00Z',
          },
        ],
      },
      { ok: true, body: { id: 'order-1', items: [] } },
      { ok: true, body: {} },
    );

    await service.pollAllBusinessUnits();

    expect(salesService.registerSale).not.toHaveBeenCalled();
  });

  it('handlePolling captura exceções sem propagar (não derruba o cron)', async () => {
    prisma.businessUnit.findMany.mockRejectedValue(new Error('banco fora do ar'));

    await expect(service.handlePolling()).resolves.toBeUndefined();
  });
});
