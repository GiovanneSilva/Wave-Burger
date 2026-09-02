import { BadRequestException, Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../auth/permissions.constants';
import { AuthenticatedUser } from '../auth/auth.types';

/// Persistência do ID da loja (merchant) no iFood por unidade de
/// negócio — necessário desde a Fase 2 (Order Polling roda em segundo
/// plano, sem alguém digitando o valor a cada execução).
@Controller('ifood/settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IfoodSettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  async get(@CurrentUser() user: AuthenticatedUser) {
    if (!user.businessUnitId) {
      throw new BadRequestException('Usuário não está vinculado a nenhuma unidade de negócio.');
    }

    const businessUnit = await this.prisma.businessUnit.findFirst({
      where: { id: user.businessUnitId, organizationId: user.organizationId },
    });

    return { ifoodMerchantId: (businessUnit as any)?.ifoodMerchantId ?? null };
  }

  @Put()
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  async update(
    @Body('ifoodMerchantId') ifoodMerchantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!user.businessUnitId) {
      throw new BadRequestException('Usuário não está vinculado a nenhuma unidade de negócio.');
    }

    await this.prisma.businessUnit.update({
      where: { id: user.businessUnitId },
      data: { ifoodMerchantId: ifoodMerchantId || null } as any,
    });

    return { ifoodMerchantId: ifoodMerchantId || null };
  }
}
