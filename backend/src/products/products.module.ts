import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { AuthModule } from '../auth/auth.module';
import { FICHA_TECNICA_VALIDATION_PORT } from './ficha-tecnica-validation.port';
import { PendingFichaTecnicaValidator } from './pending-ficha-tecnica.validator';

@Module({
  imports: [AuthModule],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    {
      provide: FICHA_TECNICA_VALIDATION_PORT,
      useClass: PendingFichaTecnicaValidator,
    },
  ],
  exports: [ProductsService],
})
export class ProductsModule {}
