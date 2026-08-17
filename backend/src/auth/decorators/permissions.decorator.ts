import { SetMetadata } from '@nestjs/common';
import { PermissionKey } from '../permissions.constants';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Marca a permissão exigida para acessar um endpoint. Consumido pelo
 * PermissionsGuard — mecanismo central reutilizável, nunca implementado
 * individualmente por módulo (claude/CLAUDE.md, Seção 4).
 */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
