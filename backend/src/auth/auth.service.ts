import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmailWithAuth(email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const roles = user.roles.map((userRole: { role: { name: string } }) => userRole.role.name);
    const permissions: string[] = Array.from(
      new Set(
        user.roles.flatMap(
          (userRole: { role: { permissions: { permission: { key: string } }[] } }) =>
            userRole.role.permissions.map((rp) => rp.permission.key),
        ),
      ),
    );

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        organizationId: user.organizationId,
        businessUnitId: user.businessUnitId,
        roles,
        permissions,
      },
    };
  }
}
