import { IsIn, IsNumberString, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Lista prática de unidades aceitas no cadastro do ingrediente.
 * NÃO implementa conversão entre unidades de compra/ficha técnica —
 * isso é PD-011, ainda em aberto (ver claude/CLAUDE.md).
 */
export const INGREDIENT_UNITS = ['kg', 'g', 'l', 'ml', 'un'] as const;

export class CreateIngredientDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsIn(INGREDIENT_UNITS)
  standardUnit: string;

  @IsOptional()
  @IsString()
  storageLocation?: string;

  @IsOptional()
  @IsNumberString()
  minimumStock?: string;

  @IsOptional()
  @IsNumberString()
  averageCost?: string;

  @IsOptional()
  @IsNumberString()
  lastCost?: string;
}

export class UpdateIngredientDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(INGREDIENT_UNITS)
  standardUnit?: string;

  @IsOptional()
  @IsString()
  storageLocation?: string;

  @IsOptional()
  @IsNumberString()
  minimumStock?: string;

  @IsOptional()
  @IsNumberString()
  averageCost?: string;

  @IsOptional()
  @IsNumberString()
  lastCost?: string;
}
