import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { AuthModule } from '../auth/auth.module';
import { FichaTecnicaModule } from '../ficha-tecnica/ficha-tecnica.module';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [AuthModule, FichaTecnicaModule, StockModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
