import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IfoodAuthService } from './ifood-auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../auth/permissions.constants';
import { AuthenticatedUser } from '../auth/auth.types';

/// Fase 0/1 — os dois passos manuais do fluxo de aplicativo Distribuído
/// do iFood, expostos para a tela "Configurações → Integração iFood".
@Controller('ifood/auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IfoodAuthController {
  constructor(private readonly authService: IfoodAuthService) {}

  @Post('request-user-code')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  requestUserCode(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.requestUserCode(user.organizationId);
  }

  @Post('authorize')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  async authorize(
    @Body('authorizationCode') authorizationCode: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.authService.exchangeAuthorizationCode(user.organizationId, authorizationCode);
    return { success: true };
  }
}
