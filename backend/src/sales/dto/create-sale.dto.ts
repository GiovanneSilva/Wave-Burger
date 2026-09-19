import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export enum DiscountTypeDto {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

export enum SalesChannelDto {
  WHATSAPP = 'WHATSAPP',
  INSTAGRAM = 'INSTAGRAM',
  TELEFONE = 'TELEFONE',
  PRESENCIAL = 'PRESENCIAL',
  SITE_PROPRIO = 'SITE_PROPRIO',
  OUTRO = 'OUTRO',
}

export enum PaymentMethodDto {
  DINHEIRO = 'DINHEIRO',
  PIX = 'PIX',
  CARTAO_DEBITO = 'CARTAO_DEBITO',
  CARTAO_CREDITO = 'CARTAO_CREDITO',
  VALE_REFEICAO = 'VALE_REFEICAO',
  OUTRO = 'OUTRO',
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

  /// Pedidos por fora do iFood (claude/pedidos-externos-plan.md) — todo
  /// campo abaixo é opcional de propósito: a coleta ainda está em fase
  /// de adaptação, nada deve travar o registro de uma venda por falta
  /// de dado do cliente.
  ///
  /// Cliente é identificado pelo telefone (find-or-create em
  /// SalesService); se `customerPhone` vier vazio, nenhum Customer é
  /// criado/vinculado — a venda fica "anônima", como já era antes deste
  /// recurso existir.
  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  customerNeighborhood?: string;

  @IsOptional()
  @IsString()
  customerPostalCode?: string;

  @IsOptional()
  @IsEnum(SalesChannelDto)
  salesChannel?: SalesChannelDto;

  @IsOptional()
  @IsEnum(PaymentMethodDto)
  paymentMethod?: PaymentMethodDto;

  @IsOptional()
  @IsString()
  marketingCampaignCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
