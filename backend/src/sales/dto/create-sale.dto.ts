import { IsDateString, IsEnum, IsNumberString, IsOptional, IsUUID } from 'class-validator';

export enum DiscountTypeDto {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

export class CreateSaleDto {
  @IsUUID()
  businessUnitId: string;

  @IsUUID()
  productId: string;

  @IsNumberString()
  quantity: string;

  /// Opcional: se omitido, usa Product.salePrice vigente no momento do
  /// registro (congelado em unitPriceSnapshot).
  @IsOptional()
  @IsNumberString()
  unitPrice?: string;

  @IsOptional()
  @IsEnum(DiscountTypeDto)
  discountType?: DiscountTypeDto;

  @IsOptional()
  @IsNumberString()
  discountValue?: string;

  @IsOptional()
  @IsDateString()
  saleDate?: string;
}
