import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../auth/permissions.constants';
import { AuthenticatedUser } from '../auth/auth.types';

@Controller('analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('executive')
  @RequirePermissions(PERMISSIONS.FINANCIAL_READ)
  getExecutiveDashboard(
    @Query('businessUnitId') businessUnitId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.analyticsService.getExecutiveDashboard(
      businessUnitId,
      user.organizationId,
      new Date(from),
      new Date(to),
    );
  }

  @Get('stock')
  @RequirePermissions(PERMISSIONS.STOCK_READ)
  getStockDashboard(
    @Query('businessUnitId') businessUnitId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.analyticsService.getStockDashboard(
      businessUnitId,
      user.organizationId,
      new Date(from),
      new Date(to),
    );
  }

  @Get('suppliers/:ingredientId')
  @RequirePermissions(PERMISSIONS.SUPPLIERS_READ)
  getSupplierAnalysis(
    @Param('ingredientId') ingredientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.analyticsService.getSupplierAnalysis(ingredientId, user.organizationId);
  }

  @Get('deliverable-quantities')
  @RequirePermissions(PERMISSIONS.STOCK_READ)
  getDeliverableQuantities(
    @Query('businessUnitId') businessUnitId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.analyticsService.getDeliverableQuantities(businessUnitId, user.organizationId);
  }
}
