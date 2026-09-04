import { BadRequestException, Controller, Post, UseGuards } from '@nestjs/common';
import { IfoodInventorySyncService } from './ifood-inventory-sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../auth/permissions.constants';
import { AuthenticatedUser } from '../auth/auth.types';

/// Fase 3 do plano de integração — disparo manual (a tela de
/// Configurações também ganha um botão "Sincronizar inventário agora").
/// Diferente do Catalog Sync da Fase 1, não pede `merchantId` no corpo
/// da requisição — lê o valor já salvo em `BusinessUnit.ifoodMerchantId`
/// (persistido desde a Fase 2), evitando pedir o mesmo dado duas vezes.
@Controller('ifood/inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IfoodInventoryController {
  constructor(
    private readonly inventorySyncService: IfoodInventorySyncService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('sync')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  async sync(@CurrentUser() user: AuthenticatedUser) {
    if (!user.businessUnitId) {
      throw new BadRequestException('Usuário não está vinculado a nenhuma unidade de negócio.');
    }

    const businessUnit = await this.prisma.businessUnit.findFirst({
      where: { id: user.businessUnitId, organizationId: user.organizationId },
    });

    const merchantId = (businessUnit as any)?.ifoodMerchantId;
    if (!merchantId) {
      throw new BadRequestException(
        'Nenhuma loja do iFood configurada — salve o ID da loja em Configurações antes de sincronizar.',
      );
    }

    return this.inventorySyncService.syncInventory(
      user.businessUnitId,
      user.organizationId,
      merchantId,
    );
  }
}
