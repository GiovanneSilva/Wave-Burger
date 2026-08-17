import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FichaTecnicaValidationPort } from './ficha-tecnica-validation.port';
import { PendingFichaTecnicaValidator } from './pending-ficha-tecnica.validator';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: {
    product: {
      findFirst: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let audit: { record: jest.Mock };
  let fichaTecnicaValidator: FichaTecnicaValidationPort;

  const actor = { id: 'user-1', organizationId: 'org-1' };

  function buildService(validator: FichaTecnicaValidationPort) {
    return new ProductsService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      validator,
    );
  }

  beforeEach(() => {
    prisma = {
      product: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    fichaTecnicaValidator = new PendingFichaTecnicaValidator();
    service = buildService(fichaTecnicaValidator);
  });

  describe('create', () => {
    it('cria produto sempre como DRAFT (UC-001) e registra auditoria', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      const created = { id: 'prod-1', name: 'Smash Burger', status: 'DRAFT' };
      prisma.product.create.mockResolvedValue(created);

      const result = await service.create({ name: 'Smash Burger' } as any, actor);

      expect(result.status).toBe('DRAFT');
      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'DRAFT' }) }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entity: 'Product' }),
      );
    });

    it('REJEITA nome duplicado na mesma organização', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.create({ name: 'Smash Burger' } as any, actor)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findById', () => {
    it('lança NotFoundException quando o produto não existe na organização', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(service.findById('prod-x', 'org-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('activate — BR-001', () => {
    it('BLOQUEIA ativação enquanto Ficha Técnica não existir (implementação placeholder atual)', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'prod-1', status: 'DRAFT' });

      await expect(service.activate('prod-1', actor)).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('permite ativação quando a porta de validação (futura Ficha Técnica) confirma uma ficha válida', async () => {
      const approvingValidator: FichaTecnicaValidationPort = {
        hasValidFichaTecnica: jest.fn().mockResolvedValue(true),
      };
      service = buildService(approvingValidator);

      prisma.product.findFirst.mockResolvedValue({ id: 'prod-1', status: 'DRAFT' });
      prisma.product.update.mockResolvedValue({ id: 'prod-1', status: 'ACTIVE' });

      const result = await service.activate('prod-1', actor);

      expect(result.status).toBe('ACTIVE');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ACTIVATE', entity: 'Product' }),
      );
    });
  });

  describe('deactivate', () => {
    it('inativa independentemente de ficha técnica (BR-001 só se aplica à ativação)', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'prod-1', status: 'ACTIVE' });
      prisma.product.update.mockResolvedValue({ id: 'prod-1', status: 'INACTIVE' });

      const result = await service.deactivate('prod-1', actor);

      expect(result.status).toBe('INACTIVE');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEACTIVATE', entity: 'Product' }),
      );
    });
  });
});
