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

export class FichaTecnicaItemInputDto {
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
}

export class CreateFichaTecnicaDto {
  @ArrayMinSize(1, { message: 'A ficha técnica deve possuir ao menos um ingrediente (BR-002).' })
  @ValidateNested({ each: true })
  @Type(() => FichaTecnicaItemInputDto)
  items: FichaTecnicaItemInputDto[];
}
