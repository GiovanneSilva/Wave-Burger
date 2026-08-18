import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../auth/permissions.constants';
import { AuthenticatedUser } from '../auth/auth.types';

@Controller('sales')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.SALES_MANAGE)
  register(@Body() dto: CreateSaleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.salesService.registerSale(dto, user);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SALES_READ)
  findAll(
    @Query('businessUnitId') businessUnitId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesService.findAll(user.organizationId, businessUnitId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SALES_READ)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.salesService.findById(id, user.organizationId);
  }
}
