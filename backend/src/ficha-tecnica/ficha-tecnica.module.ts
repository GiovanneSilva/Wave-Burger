import { Module } from '@nestjs/common';
import { FichaTecnicaService } from './ficha-tecnica.service';
import { FichaTecnicaController } from './ficha-tecnica.controller';
import { FichaTecnicaValidator } from './ficha-tecnica.validator';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FichaTecnicaController],
  providers: [FichaTecnicaService, FichaTecnicaValidator],
  exports: [FichaTecnicaService, FichaTecnicaValidator],
})
export class FichaTecnicaModule {}
