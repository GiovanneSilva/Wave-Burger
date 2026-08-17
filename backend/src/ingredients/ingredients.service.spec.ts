import { ConflictException, NotFoundException } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('IngredientsService', () => {
  let service: IngredientsService;
  let prisma: {
    ingredient: {
      findFirst: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let audit: { record: jest.Mock };

  const actor = { id: 'user-1', organizationId: 'org-1' };

  beforeEach(() => {
    prisma = {
      ingredient: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new IngredientsService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  describe('create', () => {
    it('cria um ingrediente e registra auditoria', async () => {
      prisma.ingredient.findFirst.mockResolvedValue(null);
      const created = { id: 'ing-1', name: 'Carne Bovina', organizationId: 'org-1' };
      prisma.ingredient.create.mockResolvedValue(created);

      const result = await service.create(
        { name: 'Carne Bovina', standardUnit: 'kg' } as any,
        actor,
      );

      expect(result).toEqual(created);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          entity: 'Ingredient',
          entityId: 'ing-1',
          organizationId: 'org-1',
          userId: 'user-1',
        }),
      );
    });

    it('REJEITA nome duplicado na mesma organização (fonte única da verdade)', async () => {
      prisma.ingredient.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({ name: 'Carne Bovina', standardUnit: 'kg' } as any, actor),
      ).rejects.toThrow(ConflictException);
      expect(prisma.ingredient.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('lança NotFoundException quando o ingrediente não existe na organização', async () => {
      prisma.ingredient.findFirst.mockResolvedValue(null);

      await expect(service.findById('ing-x', 'org-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('registra auditoria com nota sobre BR-004 quando o custo muda', async () => {
      const before = {
        id: 'ing-1',
        name: 'Carne Bovina',
        averageCost: { toString: () => '30.0000' },
        lastCost: { toString: () => '30.0000' },
      };
      prisma.ingredient.findFirst.mockResolvedValue(before);
      const updated = { ...before, averageCost: '32.0000' };
      prisma.ingredient.update.mockResolvedValue(updated);

      await service.update('ing-1', { averageCost: '32.0000' } as any, actor);

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          metadata: expect.objectContaining({ note: expect.stringContaining('BR-004') }),
        }),
      );
    });

    it('não inclui nota de recálculo quando o custo não muda', async () => {
      const before = {
        id: 'ing-1',
        name: 'Carne Bovina',
        averageCost: { toString: () => '30.0000' },
        lastCost: { toString: () => '30.0000' },
      };
      prisma.ingredient.findFirst.mockResolvedValue(before);
      prisma.ingredient.update.mockResolvedValue({ ...before, storageLocation: 'Câmara fria' });

      await service.update('ing-1', { storageLocation: 'Câmara fria' } as any, actor);

      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ metadata: undefined }));
    });
  });

  describe('deactivate / activate', () => {
    it('inativa (nunca exclui fisicamente) e registra auditoria', async () => {
      prisma.ingredient.findFirst.mockResolvedValue({ id: 'ing-1', isActive: true });
      prisma.ingredient.update.mockResolvedValue({ id: 'ing-1', isActive: false });

      const result = await service.deactivate('ing-1', actor);

      expect(result.isActive).toBe(false);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEACTIVATE', entity: 'Ingredient' }),
      );
    });
  });
});
