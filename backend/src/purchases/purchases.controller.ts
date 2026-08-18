import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../auth/permissions.constants';
import { AuthenticatedUser } from '../auth/auth.types';

@Controller('purchases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.PURCHASES_MANAGE)
  create(@Body() dto: CreatePurchaseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.purchasesService.create(dto, user);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.PURCHASES_READ)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.purchasesService.findAll(user.organizationId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PURCHASES_READ)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.purchasesService.findById(id, user.organizationId);
  }

  @Post(':id/confirm')
  @RequirePermissions(PERMISSIONS.PURCHASES_MANAGE)
  confirm(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.purchasesService.confirm(id, user);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.PURCHASES_MANAGE)
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.purchasesService.cancel(id, user);
  }
}
