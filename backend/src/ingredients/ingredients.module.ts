import { Module } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';
import { IngredientsController } from './ingredients.controller';
import { AuthModule } from '../auth/auth.module';
import { IngredientsPurchaseListener } from './ingredients-purchase.listener';

@Module({
  imports: [AuthModule],
  controllers: [IngredientsController],
  providers: [IngredientsService, IngredientsPurchaseListener],
  exports: [IngredientsService],
})
export class IngredientsModule {}
