import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PermissionKey } from '../permissions.constants';
import { AuthenticatedUser } from '../auth.types';

/**
 * Mecanismo central e reutilizável de autorização baseada em permissão
 * (BR-014, claude/CLAUDE.md Seção 4). Nenhum módulo de negócio deve
 * reimplementar esta checagem — apenas declarar `@RequirePermissions(...)`
 * em seus endpoints.
 *
 * Deve ser aplicado SEMPRE depois do JwtAuthGuard, para que `request.user`
 * já esteja populado.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user) {
      throw new ForbiddenException('Usuário não autenticado.');
    }

    const hasAllPermissions = requiredPermissions.every((permission) =>
      user.permissions.includes(permission),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException('Você não possui permissão para executar esta operação.');
    }

    return true;
  }
}
