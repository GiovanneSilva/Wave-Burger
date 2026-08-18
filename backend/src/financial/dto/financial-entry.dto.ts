import {
  IsDateString,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export enum FinancialEntryTypeDto {
  PAYABLE = 'PAYABLE',
  RECEIVABLE = 'RECEIVABLE',
}

/// RF-023: categorias financeiras explícitas do Documento Mestre.
export enum FinancialCategoryDto {
  MATERIA_PRIMA = 'MATERIA_PRIMA',
  EMBALAGEM = 'EMBALAGEM',
  MARKETING = 'MARKETING',
  ALUGUEL = 'ALUGUEL',
  ENERGIA = 'ENERGIA',
  PLATAFORMA = 'PLATAFORMA',
  ADMINISTRATIVO = 'ADMINISTRATIVO',
  MANUTENCAO = 'MANUTENCAO',
}

export class CreateFinancialEntryDto {
  @IsUUID()
  businessUnitId: string;

  @IsEnum(FinancialEntryTypeDto)
  type: FinancialEntryTypeDto;

  @IsEnum(FinancialCategoryDto)
  category: FinancialCategoryDto;

  @IsString()
  @MinLength(2)
  description: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsNumberString()
  grossAmount: string;

  @IsOptional()
  @IsNumberString()
  netAmount?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateFinancialEntryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  description?: string;

  @IsOptional()
  @IsNumberString()
  grossAmount?: string;

  @IsOptional()
  @IsNumberString()
  netAmount?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
