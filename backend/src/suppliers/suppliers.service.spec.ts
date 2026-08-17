import { ConflictException, NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('SuppliersService', () => {
  let service: SuppliersService;
  let prisma: any;
  let audit: { record: jest.Mock };

  const actor = { id: 'user-1', organizationId: 'org-1' };

  beforeEach(() => {
    prisma = {
      supplier: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      ingredient: { findFirst: jest.fn() },
      supplierIngredient: {
        updateMany: jest.fn(),
        upsert: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new SuppliersService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  describe('create', () => {
    it('cria fornecedor e registra auditoria', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);
      const created = { id: 'sup-1', name: 'Frigorífico A' };
      prisma.supplier.create.mockResolvedValue(created);

      const result = await service.create({ name: 'Frigorífico A' } as any, actor);

      expect(result).toEqual(created);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entity: 'Supplier' }),
      );
    });

    it('REJEITA nome duplicado na mesma organização', async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.create({ name: 'Frigorífico A' } as any, actor)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('linkIngredient — RF-012 (fornecedor preferencial)', () => {
    it('vincula um fornecedor a um ingrediente sem marcar como preferencial', async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: 'sup-1' });
      prisma.ingredient.findFirst.mockResolvedValue({ id: 'ing-1' });
      const txClient = {
        supplierIngredient: {
          updateMany: jest.fn(),
          upsert: jest
            .fn()
            .mockResolvedValue({ supplierId: 'sup-1', ingredientId: 'ing-1', isPreferred: false }),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(txClient));

      const result = await service.linkIngredient('sup-1', { ingredientId: 'ing-1' }, actor);

      expect(result.isPreferred).toBe(false);
      expect(txClient.supplierIngredient.updateMany).not.toHaveBeenCalled();
    });

    it('ao marcar como preferencial, desmarca qualquer outro preferencial do mesmo ingrediente ANTES de vincular', async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: 'sup-2' });
      prisma.ingredient.findFirst.mockResolvedValue({ id: 'ing-1' });

      const callOrder: string[] = [];
      const txClient = {
        supplierIngredient: {
          updateMany: jest.fn().mockImplementation(async () => {
            callOrder.push('updateMany');
          }),
          upsert: jest.fn().mockImplementation(async () => {
            callOrder.push('upsert');
            return { supplierId: 'sup-2', ingredientId: 'ing-1', isPreferred: true };
          }),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(txClient));

      const result = await service.linkIngredient(
        'sup-2',
        { ingredientId: 'ing-1', isPreferred: true },
        actor,
      );

      expect(result.isPreferred).toBe(true);
      expect(txClient.supplierIngredient.updateMany).toHaveBeenCalledWith({
        where: { ingredientId: 'ing-1', isPreferred: true },
        data: { isPreferred: false },
      });
      expect(callOrder).toEqual(['updateMany', 'upsert']); // ordem importa: desmarcar antes de marcar
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LINK_INGREDIENT_PREFERRED' }),
      );
    });

    it('lança NotFoundException quando o ingrediente não existe na organização', async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: 'sup-1' });
      prisma.ingredient.findFirst.mockResolvedValue(null);

      await expect(
        service.linkIngredient('sup-1', { ingredientId: 'ing-x' }, actor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('unlinkIngredient', () => {
    it('remove o vínculo e registra auditoria', async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: 'sup-1' });
      prisma.supplierIngredient.findUnique.mockResolvedValue({
        supplierId: 'sup-1',
        ingredientId: 'ing-1',
      });
      prisma.supplierIngredient.delete.mockResolvedValue({});

      const result = await service.unlinkIngredient('sup-1', 'ing-1', actor);

      expect(result).toEqual({ unlinked: true });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UNLINK_INGREDIENT' }),
      );
    });

    it('lança NotFoundException quando o vínculo não existe', async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: 'sup-1' });
      prisma.supplierIngredient.findUnique.mockResolvedValue(null);

      await expect(service.unlinkIngredient('sup-1', 'ing-1', actor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deactivate/activate', () => {
    it('inativa fornecedor sem excluir fisicamente', async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: 'sup-1', isActive: true });
      prisma.supplier.update.mockResolvedValue({ id: 'sup-1', isActive: false });

      const result = await service.deactivate('sup-1', actor);

      expect(result.isActive).toBe(false);
    });
  });
});
