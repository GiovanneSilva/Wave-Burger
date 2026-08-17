import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService', () => {
  let auditService: AuditService;
  let prisma: { auditLog: { create: jest.Mock; findMany: jest.Mock } };

  beforeEach(() => {
    prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    auditService = new AuditService(prisma as unknown as PrismaService);
  });

  it('registra uma entrada de auditoria com todos os campos obrigatórios', async () => {
    await auditService.record({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'UPDATE',
      entity: 'User',
      entityId: 'user-1',
      previousValue: { name: 'Antigo' },
      newValue: { name: 'Novo' },
      metadata: { reason: 'correção de cadastro' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'UPDATE',
        entity: 'User',
        entityId: 'user-1',
        previousValue: { name: 'Antigo' },
        newValue: { name: 'Novo' },
        metadata: { reason: 'correção de cadastro' },
      },
    });
  });

  it('registra uma entrada mesmo sem previousValue/newValue/metadata (todos opcionais)', async () => {
    await auditService.record({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'LOGIN',
      entity: 'User',
      entityId: 'user-1',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'LOGIN',
        entity: 'User',
        entityId: 'user-1',
        previousValue: undefined,
        newValue: undefined,
        metadata: undefined,
      },
    });
  });

  it('busca histórico de uma entidade específica ordenado do mais recente para o mais antigo', async () => {
    await auditService.findByEntity('User', 'user-1');

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { entity: 'User', entityId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    });
  });
});
