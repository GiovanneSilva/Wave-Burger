import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../auth/permissions.constants';
import { AuthenticatedUser } from '../auth/auth.types';

@Controller('products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.create(dto, user);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.PRODUCTS_READ)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.productsService.findAll(user.organizationId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PRODUCTS_READ)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.findById(id, user.organizationId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productsService.update(id, dto, user);
  }

  @Patch(':id/activate')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  activate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.activate(id, user);
  }

  @Patch(':id/deactivate')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.deactivate(id, user);
  }
}
