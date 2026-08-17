import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { AuthenticatedUser } from '../auth.types';

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'dev-secret-change-me'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findByEmailWithAuth(payload.email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuário inválido ou inativo.');
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

    return {
      id: user.id,
      organizationId: user.organizationId,
      businessUnitId: user.businessUnitId,
      email: user.email,
      name: user.name,
      roles,
      permissions,
    };
  }
}
