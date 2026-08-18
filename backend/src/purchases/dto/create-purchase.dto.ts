import {
  ArrayMinSize,
  IsDateString,
  IsIn,
  IsNumberString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { INGREDIENT_UNITS } from '../../ingredients/dto/ingredient.dto';

export class PurchaseItemInputDto {
  @IsUUID()
  ingredientId: string;

  @IsNumberString()
  quantity: string;

  @IsIn(INGREDIENT_UNITS)
  unit: string;

  @IsNumberString()
  unitPrice: string;
}

export class CreatePurchaseDto {
  @IsUUID()
  supplierId: string;

  @IsUUID()
  businessUnitId: string;

  @IsDateString()
  purchaseDate: string;

  @ArrayMinSize(1, { message: 'A compra deve possuir ao menos um item.' })
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemInputDto)
  items: PurchaseItemInputDto[];
}
