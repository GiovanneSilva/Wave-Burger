import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FichaTecnicaService } from './ficha-tecnica.service';
import { CreateFichaTecnicaDto } from './dto/create-ficha-tecnica.dto';
import { SimulateFichaTecnicaDto } from './dto/simulate-ficha-tecnica.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../auth/permissions.constants';
import { AuthenticatedUser } from '../auth/auth.types';

@Controller('products/:productId/ficha-tecnica')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FichaTecnicaController {
  constructor(private readonly fichaTecnicaService: FichaTecnicaService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.FICHA_TECNICA_MANAGE)
  createNewVersion(
    @Param('productId') productId: string,
    @Body() dto: CreateFichaTecnicaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fichaTecnicaService.createNewVersion(productId, dto, user);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.FICHA_TECNICA_READ)
  findCurrent(@Param('productId') productId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.fichaTecnicaService.findCurrentByProduct(productId, user.organizationId);
  }

  @Get('history')
  @RequirePermissions(PERMISSIONS.FICHA_TECNICA_READ)
  findHistory(@Param('productId') productId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.fichaTecnicaService.findHistoryByProduct(productId, user.organizationId);
  }

  @Get('current-cost')
  @RequirePermissions(PERMISSIONS.FICHA_TECNICA_READ)
  getCurrentCostSummary(
    @Param('productId') productId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fichaTecnicaService.getCurrentCostSummary(productId, user.organizationId);
  }

  /// RF-008: preview de "e se" — não altera nada, só calcula.
  @Post('simulate')
  @RequirePermissions(PERMISSIONS.FICHA_TECNICA_READ)
  simulate(
    @Param('productId') productId: string,
    @Body() dto: SimulateFichaTecnicaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fichaTecnicaService.simulate(productId, dto, user.organizationId);
  }
}
