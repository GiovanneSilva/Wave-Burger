import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';
import { CreateIngredientDto, UpdateIngredientDto } from './dto/ingredient.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../auth/permissions.constants';
import { AuthenticatedUser } from '../auth/auth.types';

@Controller('ingredients')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.INGREDIENTS_MANAGE)
  create(@Body() dto: CreateIngredientDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ingredientsService.create(dto, user);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.INGREDIENTS_READ)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.ingredientsService.findAll(user.organizationId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.INGREDIENTS_READ)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ingredientsService.findById(id, user.organizationId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.INGREDIENTS_MANAGE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateIngredientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ingredientsService.update(id, dto, user);
  }

  @Patch(':id/activate')
  @RequirePermissions(PERMISSIONS.INGREDIENTS_MANAGE)
  activate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ingredientsService.activate(id, user);
  }

  @Patch(':id/deactivate')
  @RequirePermissions(PERMISSIONS.INGREDIENTS_MANAGE)
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ingredientsService.deactivate(id, user);
  }
}
