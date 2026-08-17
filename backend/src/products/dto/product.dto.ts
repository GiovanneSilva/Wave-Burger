import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  internalCode?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsNumberString()
  salePrice?: string;

  @IsOptional()
  @IsNumberString()
  promotionalPrice?: string;

  @IsOptional()
  @IsDateString()
  promotionalPeriodStart?: string;

  @IsOptional()
  @IsDateString()
  promotionalPeriodEnd?: string;

  @IsOptional()
  @IsNumberString()
  finalWeight?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  averagePrepTimeMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  internalCode?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsNumberString()
  salePrice?: string;

  @IsOptional()
  @IsNumberString()
  promotionalPrice?: string;

  @IsOptional()
  @IsDateString()
  promotionalPeriodStart?: string;

  @IsOptional()
  @IsDateString()
  promotionalPeriodEnd?: string;

  @IsOptional()
  @IsNumberString()
  finalWeight?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  averagePrepTimeMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
