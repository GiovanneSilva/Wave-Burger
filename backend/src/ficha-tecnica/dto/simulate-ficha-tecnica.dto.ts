import {
  ArrayMinSize,
  IsIn,
  IsNumberString,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { INGREDIENT_UNITS } from '../../ingredients/dto/ingredient.dto';

/// RF-008: cada item aceita `costOverride` (simula "trocar fornecedor" —
/// custo hipotético por unidade padrão, sem alterar Ingredient.averageCost
/// de verdade) e `quantity` livre (simula "aumentar gramatura").
export class SimulationItemDto {
  @IsUUID()
  ingredientId: string;

  @IsNumberString()
  quantity: string;

  @IsIn(INGREDIENT_UNITS)
  unit: string;

  @IsOptional()
  @Min(0)
  @Max(100)
  lossPercentage?: number;

  @IsOptional()
  @IsNumberString()
  costOverride?: string;
}

/// `salePriceOverride` simula "alterar preço" ou "conceder desconto"
/// (mostra o impacto no cálculo — não implementa política de aprovação
/// de desconto, que é PD-007, ainda em aberto).
export class SimulateFichaTecnicaDto {
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SimulationItemDto)
  items: SimulationItemDto[];

  @IsOptional()
  @IsNumberString()
  salePriceOverride?: string;
}
