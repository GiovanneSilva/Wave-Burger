import { Module } from '@nestjs/common';
import { FinancialService } from './financial.service';
import { FinancialController } from './financial.controller';
import { FinancialPurchaseListener } from './financial-purchase.listener';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FinancialController],
  providers: [FinancialService, FinancialPurchaseListener],
  exports: [FinancialService],
})
export class FinancialModule {}
