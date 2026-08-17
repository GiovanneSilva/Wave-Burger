/**
 * Payload para registrar uma ação crítica no mecanismo central de
 * auditoria (RF-033). `entity` é o nome lógico da entidade afetada
 * (ex.: "User", "Ingredient", "FichaTecnica") — livre, não é uma FK,
 * para não acoplar o audit log ao schema de cada módulo de negócio
 * futuro (claude/CLAUDE.md, Seção 4 — modularidade).
 */
export interface RecordAuditEntryInput {
  organizationId: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
}

export interface FindAuditLogsFilter {
  organizationId?: string;
  entity?: string;
  entityId?: string;
  userId?: string;
}
