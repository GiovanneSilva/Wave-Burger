import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IfoodCatalogSyncService } from './ifood-catalog-sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../auth/permissions.constants';
import { AuthenticatedUser } from '../auth/auth.types';

/// Fase 1 do plano de integração — disparo manual (a futura tela
/// "Configurações → Integração iFood" vai chamar isso pelo botão
/// "Sincronizar catálogo agora"). Reutiliza `products:manage` — é
/// literalmente uma operação sobre produtos, não justifica uma
/// permissão nova só para isso.
@Controller('ifood/catalog')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IfoodCatalogController {
  constructor(private readonly catalogSyncService: IfoodCatalogSyncService) {}

  @Post('sync')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  syncAll(@Body('merchantId') merchantId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.catalogSyncService.syncAll(user.organizationId, merchantId);
  }
}
