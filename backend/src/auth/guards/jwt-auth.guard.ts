import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Exige um JWT válido. Base de toda rota protegida — o
 * PermissionsGuard assume que este guard já rodou e populou request.user.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
