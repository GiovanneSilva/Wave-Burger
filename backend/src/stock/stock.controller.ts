import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { StockService } from './stock.service';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../auth/permissions.constants';
import { AuthenticatedUser } from '../auth/auth.types';

@Controller('stock')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post('adjustments')
  @RequirePermissions(PERMISSIONS.STOCK_MANAGE)
  createAdjustment(@Body() dto: CreateStockAdjustmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.stockService.createManualAdjustment(dto, user);
  }

  @Get('balances')
  @RequirePermissions(PERMISSIONS.STOCK_READ)
  listBalances(
    @Query('businessUnitId') businessUnitId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stockService.listBalances(businessUnitId, user.organizationId);
  }

  @Get('balances/:businessUnitId/:ingredientId')
  @RequirePermissions(PERMISSIONS.STOCK_READ)
  getBalance(
    @Param('businessUnitId') businessUnitId: string,
    @Param('ingredientId') ingredientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stockService.getBalance(businessUnitId, ingredientId, user.organizationId);
  }

  @Get('below-minimum')
  @RequirePermissions(PERMISSIONS.STOCK_READ)
  listBelowMinimum(
    @Query('businessUnitId') businessUnitId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stockService.listBelowMinimum(businessUnitId, user.organizationId);
  }

  @Get('movements')
  @RequirePermissions(PERMISSIONS.STOCK_READ)
  listMovements(
    @Query('businessUnitId') businessUnitId: string,
    @Query('ingredientId') ingredientId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stockService.listMovements(businessUnitId, user.organizationId, ingredientId);
  }
}
