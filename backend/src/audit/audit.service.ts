import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FindAuditLogsFilter, RecordAuditEntryInput } from './audit.types';

/**
 * Mecanismo central de auditoria (RF-033, BR-013, BR-015).
 *
 * Todo módulo de negócio que precisar registrar uma ação crítica deve
 * injetar este serviço e chamar `record(...)` — nunca implementar
 * auditoria própria (claude/CLAUDE.md, Seção 4).
 *
 * A tabela subjacente (`audit_logs`) é append-only por trigger no banco
 * (ver migration 20260817140000_audit_log); tentativas de UPDATE/DELETE
 * são rejeitadas pelo PostgreSQL, não apenas por convenção de aplicação.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditEntryInput) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        previousValue: input.previousValue as any,
        newValue: input.newValue as any,
        metadata: input.metadata as any,
      },
    });
  }

  /// Suporte ao princípio de "auditoria como ferramenta de diagnóstico
  /// operacional" (Documento Mestre, Seção 9): permite reconstruir o
  /// histórico de uma entidade específica (ex.: por que a margem de um
  /// produto caiu).
  async findByEntity(entity: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMany(filter: FindAuditLogsFilter) {
    return this.prisma.auditLog.findMany({
      where: {
        organizationId: filter.organizationId,
        entity: filter.entity,
        entityId: filter.entityId,
        userId: filter.userId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
