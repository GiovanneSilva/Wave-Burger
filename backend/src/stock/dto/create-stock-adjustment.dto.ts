import { IsEnum, IsIn, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';
import { INGREDIENT_UNITS } from '../../ingredients/dto/ingredient.dto';

export enum AdjustmentDirectionDto {
  IN = 'IN',
  OUT = 'OUT',
}

export enum AdjustmentReasonDto {
  LOSS = 'LOSS',
  WASTE = 'WASTE',
  INVENTORY = 'INVENTORY',
  CORRECTION = 'CORRECTION',
  RETURN = 'RETURN',
}

/// RF-017: ajuste manual de estoque. `reason` é obrigatório (também
/// reforçado por CHECK constraint no banco).
export class CreateStockAdjustmentDto {
  @IsUUID()
  businessUnitId: string;

  @IsUUID()
  ingredientId: string;

  @IsEnum(AdjustmentDirectionDto)
  direction: AdjustmentDirectionDto;

  @IsNumberString()
  quantity: string;

  @IsIn(INGREDIENT_UNITS)
  unit: string;

  @IsEnum(AdjustmentReasonDto)
  reason: AdjustmentReasonDto;

  @IsOptional()
  @IsString()
  notes?: string;
}
