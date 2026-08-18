import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { FinancialService } from './financial.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('FinancialService', () => {
  let service: FinancialService;
  let prisma: any;
  let audit: { record: jest.Mock };

  const actor = { id: 'user-1', organizationId: 'org-1' };

  beforeEach(() => {
    prisma = {
      businessUnit: { findFirst: jest.fn() },
      supplier: { findFirst: jest.fn() },
      financialEntry: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new FinancialService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  describe('create', () => {
    it('cria um lançamento e registra auditoria', async () => {
      prisma.businessUnit.findFirst.mockResolvedValue({ id: 'bu-1' });
      const created = { id: 'entry-1', type: 'PAYABLE' };
      prisma.financialEntry.create.mockResolvedValue(created);

      const result = await service.create(
        {
          businessUnitId: 'bu-1',
          type: 'PAYABLE',
          category: 'ALUGUEL',
          description: 'Aluguel de agosto',
          grossAmount: '2000',
        } as any,
        actor,
      );

      expect(result).toEqual(created);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entity: 'FinancialEntry' }),
      );
    });

    it('lança NotFoundException quando a unidade de negócio não existe', async () => {
      prisma.businessUnit.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          {
            businessUnitId: 'bu-x',
            type: 'PAYABLE',
            category: 'ALUGUEL',
            description: 'x',
            grossAmount: '1',
          } as any,
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createEntryFromPurchase — BR-007', () => {
    it('cria lançamento PAYABLE categorizado MATERIA_PRIMA vinculado à compra', async () => {
      prisma.financialEntry.create.mockResolvedValue({ id: 'entry-1' });

      await service.createEntryFromPurchase({
        organizationId: 'org-1',
        businessUnitId: 'bu-1',
        supplierId: 'sup-1',
        purchaseId: 'pur-1',
        grossAmount: 150,
        createdByUserId: 'user-1',
      });

      expect(prisma.financialEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'PAYABLE',
            category: 'MATERIA_PRIMA',
            purchaseId: 'pur-1',
            supplierId: 'sup-1',
            grossAmount: 150,
          }),
        }),
      );
    });
  });

  describe('markAsPaid', () => {
    it('liquida um lançamento pendente', async () => {
      prisma.financialEntry.findFirst.mockResolvedValue({ id: 'entry-1', status: 'PENDING' });
      prisma.financialEntry.update.mockResolvedValue({ id: 'entry-1', status: 'PAID' });

      const result = await service.markAsPaid('entry-1', actor);

      expect(result.status).toBe('PAID');
    });

    it('REJEITA liquidar um lançamento já cancelado', async () => {
      prisma.financialEntry.findFirst.mockResolvedValue({ id: 'entry-1', status: 'CANCELLED' });

      await expect(service.markAsPaid('entry-1', actor)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('cancel', () => {
    it('REJEITA cancelar um lançamento já pago', async () => {
      prisma.financialEntry.findFirst.mockResolvedValue({ id: 'entry-1', status: 'PAID' });

      await expect(service.cancel('entry-1', actor)).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('getDre — RF-024/BR-016 (integração com dados reais)', () => {
    it('agrupa lançamentos liquidados por tipo/categoria e calcula o DRE corretamente', async () => {
      prisma.businessUnit.findFirst.mockResolvedValue({ id: 'bu-1' });
      prisma.financialEntry.findMany.mockResolvedValue([
        { type: 'RECEIVABLE', category: null, grossAmount: '6000' },
        { type: 'RECEIVABLE', category: null, grossAmount: '4000' },
        { type: 'PAYABLE', category: 'PLATAFORMA', grossAmount: '1200' },
        { type: 'PAYABLE', category: 'MATERIA_PRIMA', grossAmount: '3000' },
        { type: 'PAYABLE', category: 'ALUGUEL', grossAmount: '2000' },
      ]);

      const result = await service.getDre(
        'bu-1',
        'org-1',
        new Date('2026-08-01'),
        new Date('2026-08-31'),
        0,
      );

      expect(result.receitaBruta).toBe(10000);
      expect(result.taxas).toBe(1200);
      expect(result.cmv).toBe(3000);
      expect(result.despesasOperacionais).toBe(2000);
      expect(result.resultadoOperacional).toBe(3800); // 10000-1200-0-3000-2000
    });
  });
});
