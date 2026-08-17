import { Module } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
