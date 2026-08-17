import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto, LinkIngredientDto, UpdateSupplierDto } from './dto/supplier.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../auth/permissions.constants';
import { AuthenticatedUser } from '../auth/auth.types';

@Controller('suppliers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.SUPPLIERS_MANAGE)
  create(@Body() dto: CreateSupplierDto, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.create(dto, user);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SUPPLIERS_READ)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.findAll(user.organizationId);
  }

  @Get('by-ingredient/:ingredientId')
  @RequirePermissions(PERMISSIONS.SUPPLIERS_READ)
  findByIngredient(
    @Param('ingredientId') ingredientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.suppliersService.findSuppliersByIngredient(ingredientId, user.organizationId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SUPPLIERS_READ)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.findById(id, user.organizationId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SUPPLIERS_MANAGE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.suppliersService.update(id, dto, user);
  }

  @Patch(':id/activate')
  @RequirePermissions(PERMISSIONS.SUPPLIERS_MANAGE)
  activate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.activate(id, user);
  }

  @Patch(':id/deactivate')
  @RequirePermissions(PERMISSIONS.SUPPLIERS_MANAGE)
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.deactivate(id, user);
  }

  @Get(':id/ingredients')
  @RequirePermissions(PERMISSIONS.SUPPLIERS_READ)
  findIngredients(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.findIngredientsBySupplier(id, user.organizationId);
  }

  @Post(':id/ingredients')
  @RequirePermissions(PERMISSIONS.SUPPLIERS_MANAGE)
  linkIngredient(
    @Param('id') id: string,
    @Body() dto: LinkIngredientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.suppliersService.linkIngredient(id, dto, user);
  }

  @Delete(':id/ingredients/:ingredientId')
  @RequirePermissions(PERMISSIONS.SUPPLIERS_MANAGE)
  unlinkIngredient(
    @Param('id') id: string,
    @Param('ingredientId') ingredientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.suppliersService.unlinkIngredient(id, ingredientId, user);
  }
}
