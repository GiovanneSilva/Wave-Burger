import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: { findByEmailWithAuth: jest.Mock };
  let jwtService: { signAsync: jest.Mock };

  const buildUserRecord = async (overrides: Record<string, unknown> = {}) => ({
    id: 'user-1',
    organizationId: 'org-1',
    businessUnitId: 'unit-1',
    name: 'Administrador',
    email: 'admin@waveburger.dev',
    passwordHash: await bcrypt.hash('senha-correta', 10),
    isActive: true,
    roles: [
      {
        role: {
          name: 'ADMIN',
          permissions: [{ permission: { key: 'users:manage' } }],
        },
      },
    ],
    ...overrides,
  });

  beforeEach(() => {
    usersService = { findByEmailWithAuth: jest.fn() };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
    authService = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
    );
  });

  it('autentica com sucesso e retorna token + permissões do usuário', async () => {
    usersService.findByEmailWithAuth.mockResolvedValue(await buildUserRecord());

    const result = await authService.login('admin@waveburger.dev', 'senha-correta');

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.user.permissions).toEqual(['users:manage']);
    expect(result.user.roles).toEqual(['ADMIN']);
  });

  it('BLOQUEIA login com senha incorreta', async () => {
    usersService.findByEmailWithAuth.mockResolvedValue(await buildUserRecord());

    await expect(authService.login('admin@waveburger.dev', 'senha-errada')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('BLOQUEIA login de usuário inexistente', async () => {
    usersService.findByEmailWithAuth.mockResolvedValue(null);

    await expect(authService.login('ninguem@waveburger.dev', 'qualquer')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('BLOQUEIA login de usuário inativo mesmo com senha correta', async () => {
    usersService.findByEmailWithAuth.mockResolvedValue(await buildUserRecord({ isActive: false }));

    await expect(authService.login('admin@waveburger.dev', 'senha-correta')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
