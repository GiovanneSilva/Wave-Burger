import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AuthModule } from '../auth/auth.module';
import { FichaTecnicaModule } from '../ficha-tecnica/ficha-tecnica.module';
import { StockModule } from '../stock/stock.module';
import { FinancialModule } from '../financial/financial.module';
import { SuppliersModule } from '../suppliers/suppliers.module';

@Module({
  imports: [AuthModule, FichaTecnicaModule, StockModule, FinancialModule, SuppliersModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
