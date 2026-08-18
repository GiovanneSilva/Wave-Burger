import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FichaTecnicaService } from '../ficha-tecnica/ficha-tecnica.service';
import { StockService } from '../stock/stock.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SALE_REGISTERED_EVENT, SaleRegisteredEvent } from './events/sale-registered.event';

interface ActingUser {
  id: string;
  organizationId: string;
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly fichaTecnicaService: FichaTecnicaService,
    private readonly stockService: StockService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /// RF-016/BR-009: registra a venda e consome os ingredientes segundo a
  /// ficha técnica vigente, de forma SÍNCRONA e transacional (UC-004
  /// descreve isso como parte do mesmo caso de uso — diferente do padrão
  /// de evento usado em Compras, cujos efeitos em Estoque/Financeiro
  /// ainda não existiam na época).
  ///
  /// PD-001 (resolvido nesta etapa, especificamente para Vendas): a
  /// venda NUNCA é bloqueada por falta de estoque. Quando o consumo
  /// deixaria algum saldo negativo, a venda é registrada normalmente e
  /// `hadInsufficientStock`/`stockWarnings` sinalizam o ocorrido.
  async registerSale(dto: CreateSaleDto, actor: ActingUser) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, organizationId: actor.organizationId },
    });
    if (!product) {
      throw new NotFoundException('Produto não encontrado.');
    }
    if (product.status !== 'ACTIVE') {
      throw new UnprocessableEntityException(
        'Só é possível vender produtos ativos (com ficha técnica válida, BR-001).',
      );
    }

    const unitPrice = dto.unitPrice
      ? Number(dto.unitPrice)
      : product.salePrice
        ? Number(product.salePrice)
        : null;
    if (unitPrice === null) {
      throw new BadRequestException(
        'Produto não possui preço de venda definido e nenhum preço foi informado na venda.',
      );
    }

    const quantity = Number(dto.quantity);
    const grossAmount = round4(quantity * unitPrice);
    const discountAmount = this.calculateDiscount(grossAmount, dto.discountType, dto.discountValue);
    const netAmount = round4(grossAmount - discountAmount);

    const fichaTecnica = await this.fichaTecnicaService.findCurrentByProduct(
      dto.productId,
      actor.organizationId,
    );

    const stockWarnings: Array<{
      ingredientId: string;
      ingredientName: string;
      resultingBalance: unknown;
    }> = [];

    const sale = await this.prisma.$transaction(async (tx: typeof this.prisma) => {
      const created = await tx.sale.create({
        data: {
          organizationId: actor.organizationId,
          businessUnitId: dto.businessUnitId,
          productId: dto.productId,
          quantity,
          unitPriceSnapshot: unitPrice,
          grossAmount,
          discountType: dto.discountType,
          discountValue: dto.discountValue,
          discountAmount,
          netAmount,
          saleDate: dto.saleDate ? new Date(dto.saleDate) : new Date(),
          soldByUserId: actor.id,
        },
      });

      for (const item of (fichaTecnica as any).items) {
        const result = await this.stockService.applyMovementInTransaction(tx, {
          organizationId: actor.organizationId,
          businessUnitId: dto.businessUnitId,
          ingredientId: item.ingredientId,
          direction: 'OUT',
          source: 'SALE',
          quantity: Number(item.quantity) * quantity,
          unit: item.unit,
          saleId: created.id,
          performedByUserId: actor.id,
          allowNegative: true, // PD-001: venda nunca bloqueia por estoque
        });

        if (result.wentNegative) {
          stockWarnings.push({
            ingredientId: item.ingredientId,
            ingredientName: result.ingredientName,
            resultingBalance: result.balance.currentQuantity,
          });
        }
      }

      if (stockWarnings.length > 0) {
        return tx.sale.update({
          where: { id: created.id },
          data: { hadInsufficientStock: true },
        });
      }

      return created;
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'CREATE',
      entity: 'Sale',
      entityId: sale.id,
      newValue: sale,
      metadata: stockWarnings.length > 0 ? { stockWarnings } : undefined,
    });

    const event: SaleRegisteredEvent = {
      saleId: sale.id,
      organizationId: actor.organizationId,
      businessUnitId: dto.businessUnitId,
      productId: dto.productId,
      netAmount: sale.netAmount.toString(),
      soldByUserId: actor.id,
      saleDate: sale.saleDate,
    };
    this.eventEmitter.emit(SALE_REGISTERED_EVENT, event);

    return { ...sale, stockWarnings };
  }

  async findAll(organizationId: string, businessUnitId?: string) {
    return this.prisma.sale.findMany({
      where: { organizationId, businessUnitId },
      orderBy: { saleDate: 'desc' },
    });
  }

  async findById(id: string, organizationId: string) {
    const sale = await this.prisma.sale.findFirst({ where: { id, organizationId } });
    if (!sale) {
      throw new NotFoundException('Venda não encontrada.');
    }
    return sale;
  }

  private calculateDiscount(
    grossAmount: number,
    discountType: string | undefined,
    discountValue: string | undefined,
  ): number {
    if (!discountType || discountValue === undefined) {
      return 0;
    }

    const value = Number(discountValue);
    const amount =
      discountType === 'PERCENTAGE' ? round4((grossAmount * value) / 100) : round4(value);

    if (amount > grossAmount) {
      throw new BadRequestException('Desconto não pode ser maior que o valor bruto da venda.');
    }
    if (amount < 0) {
      throw new BadRequestException('Desconto não pode ser negativo.');
    }

    return amount;
  }
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
