import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { FinancialService } from './financial.service';
import { CreateFinancialEntryDto, UpdateFinancialEntryDto } from './dto/financial-entry.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../auth/permissions.constants';
import { AuthenticatedUser } from '../auth/auth.types';

@Controller('financial')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  @Post('entries')
  @RequirePermissions(PERMISSIONS.FINANCIAL_MANAGE)
  create(@Body() dto: CreateFinancialEntryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.financialService.create(dto, user);
  }

  @Get('entries')
  @RequirePermissions(PERMISSIONS.FINANCIAL_READ)
  findAll(
    @Query('businessUnitId') businessUnitId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.financialService.findAll(user.organizationId, businessUnitId);
  }

  @Get('entries/:id')
  @RequirePermissions(PERMISSIONS.FINANCIAL_READ)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.financialService.findById(id, user.organizationId);
  }

  @Patch('entries/:id')
  @RequirePermissions(PERMISSIONS.FINANCIAL_MANAGE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFinancialEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.financialService.update(id, dto, user);
  }

  @Patch('entries/:id/pay')
  @RequirePermissions(PERMISSIONS.FINANCIAL_MANAGE)
  markAsPaid(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.financialService.markAsPaid(id, user);
  }

  @Patch('entries/:id/cancel')
  @RequirePermissions(PERMISSIONS.FINANCIAL_MANAGE)
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.financialService.cancel(id, user);
  }

  @Get('cash-flow')
  @RequirePermissions(PERMISSIONS.FINANCIAL_READ)
  getCashFlow(
    @Query('businessUnitId') businessUnitId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.financialService.getCashFlow(
      businessUnitId,
      user.organizationId,
      new Date(from),
      new Date(to),
    );
  }

  @Get('dre')
  @RequirePermissions(PERMISSIONS.FINANCIAL_READ)
  getDre(
    @Query('businessUnitId') businessUnitId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('impostos') impostos: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.financialService.getDre(
      businessUnitId,
      user.organizationId,
      new Date(from),
      new Date(to),
      impostos ? Number(impostos) : 0,
    );
  }
}
