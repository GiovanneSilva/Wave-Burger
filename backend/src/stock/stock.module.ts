import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { StockPurchaseListener } from './stock-purchase.listener';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [StockController],
  providers: [StockService, StockPurchaseListener],
  exports: [StockService],
})
export class StockModule {}
