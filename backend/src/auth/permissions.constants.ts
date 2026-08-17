/**
 * Chaves de permissão do mecanismo central de autorização
 * (claude/CLAUDE.md, Seção 4).
 *
 * Nesta etapa (Etapa 6) só existem as permissões fundacionais do próprio
 * módulo de usuários/perfis. Módulos de negócio (Ingredientes, Produtos,
 * Estoque, Financeiro, etc.) deverão declarar suas próprias chaves quando
 * forem implementados — sem duplicar o mecanismo de checagem.
 */
export const PERMISSIONS = {
  USERS_MANAGE: 'users:manage',
  ROLES_MANAGE: 'roles:manage',
  INGREDIENTS_READ: 'ingredients:read',
  INGREDIENTS_MANAGE: 'ingredients:manage',
  PRODUCTS_READ: 'products:read',
  PRODUCTS_MANAGE: 'products:manage',
  FICHA_TECNICA_READ: 'ficha_tecnica:read',
  FICHA_TECNICA_MANAGE: 'ficha_tecnica:manage',
  SUPPLIERS_READ: 'suppliers:read',
  SUPPLIERS_MANAGE: 'suppliers:manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
