import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { AuthModule } from '../auth/auth.module';
import { FICHA_TECNICA_VALIDATION_PORT } from './ficha-tecnica-validation.port';
import { FichaTecnicaModule } from '../ficha-tecnica/ficha-tecnica.module';
import { FichaTecnicaValidator } from '../ficha-tecnica/ficha-tecnica.validator';

@Module({
  imports: [AuthModule, FichaTecnicaModule],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    {
      // Etapa 10: PendingFichaTecnicaValidator (Etapa 9, sempre negava)
      // substituído pela implementação real — BR-001 agora é verificado
      // de verdade contra a Ficha Técnica corrente do produto.
      provide: FICHA_TECNICA_VALIDATION_PORT,
      useExisting: FichaTecnicaValidator,
    },
  ],
  exports: [ProductsService],
})
export class ProductsModule {}
