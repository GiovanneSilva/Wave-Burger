import { Module } from '@nestjs/common';
import { FinancialService } from './financial.service';
import { FinancialController } from './financial.controller';
import { FinancialPurchaseListener } from './financial-purchase.listener';
import { SalesFinancialListener } from './sales-financial.listener';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FinancialController],
  providers: [FinancialService, FinancialPurchaseListener, SalesFinancialListener],
  exports: [FinancialService],
})
export class FinancialModule {}
