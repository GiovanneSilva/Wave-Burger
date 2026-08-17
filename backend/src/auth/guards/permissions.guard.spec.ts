import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { AuthenticatedUser } from '../auth.types';

function buildContext(user: AuthenticatedUser | undefined) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

function buildUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'user-1',
    organizationId: 'org-1',
    businessUnitId: null,
    email: 'user@waveburger.dev',
    name: 'Usuário Teste',
    roles: ['STOCK_OPERATOR'],
    permissions: [],
    ...overrides,
  };
}

describe('PermissionsGuard', () => {
  let reflector: Reflector;
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  it('permite acesso quando o endpoint não exige nenhuma permissão', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = buildContext(buildUser());

    expect(guard.canActivate(context)).toBe(true);
  });

  it('permite acesso quando o usuário possui a permissão exigida', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['users:manage']);
    const context = buildContext(buildUser({ permissions: ['users:manage'] }));

    expect(guard.canActivate(context)).toBe(true);
  });

  it('BLOQUEIA acesso quando o usuário não possui a permissão exigida', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['users:manage']);
    const context = buildContext(buildUser({ permissions: ['roles:manage'] }));

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('BLOQUEIA acesso quando não há usuário autenticado na requisição', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['users:manage']);
    const context = buildContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('exige TODAS as permissões quando mais de uma é declarada', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['users:manage', 'roles:manage']);
    const context = buildContext(buildUser({ permissions: ['users:manage'] }));

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
