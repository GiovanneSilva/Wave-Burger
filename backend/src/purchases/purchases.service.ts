import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import {
  PURCHASE_CONFIRMED_EVENT,
  PurchaseConfirmedEvent,
} from './events/purchase-confirmed.event';

interface ActingUser {
  id: string;
  organizationId: string;
}

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /// RF-014: registra uma compra como DRAFT. Nenhum efeito em estoque,
  /// custo ou financeiro ocorre aqui — só na confirmação.
  async create(dto: CreatePurchaseDto, actor: ActingUser) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, organizationId: actor.organizationId },
    });
    if (!supplier) {
      throw new NotFoundException('Fornecedor não encontrado.');
    }

    const businessUnit = await this.prisma.businessUnit.findFirst({
      where: { id: dto.businessUnitId, organizationId: actor.organizationId },
    });
    if (!businessUnit) {
      throw new NotFoundException('Unidade de negócio não encontrada.');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('A compra deve possuir ao menos um item.');
    }

    const ingredientIds = dto.items.map((item) => item.ingredientId);
    const ingredients = await this.prisma.ingredient.findMany({
      where: { id: { in: ingredientIds }, organizationId: actor.organizationId },
    });
    const ingredientIdSet = new Set(ingredients.map((i: { id: string }) => i.id));

    const itemsData = dto.items.map((item) => {
      if (!ingredientIdSet.has(item.ingredientId)) {
        throw new NotFoundException(`Ingrediente ${item.ingredientId} não encontrado.`);
      }
      const totalPrice = round4(Number(item.quantity) * Number(item.unitPrice));
      return {
        ingredientId: item.ingredientId,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice,
      };
    });

    const totalAmount = round4(itemsData.reduce((sum, item) => sum + item.totalPrice, 0));

    const created = await this.prisma.purchase.create({
      data: {
        organizationId: actor.organizationId,
        businessUnitId: dto.businessUnitId,
        supplierId: dto.supplierId,
        purchaseDate: dto.purchaseDate,
        status: 'DRAFT',
        totalAmount,
        createdByUserId: actor.id,
        items: { create: itemsData },
      },
      include: { items: true },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'CREATE',
      entity: 'Purchase',
      entityId: created.id,
      newValue: created,
    });

    return created;
  }

  async findAll(organizationId: string) {
    return this.prisma.purchase.findMany({
      where: { organizationId },
      orderBy: { purchaseDate: 'desc' },
      include: { items: true },
    });
  }

  async findById(id: string, organizationId: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, organizationId },
      include: { items: true },
    });
    if (!purchase) {
      throw new NotFoundException('Compra não encontrada.');
    }
    return purchase;
  }

  /// RF-014: confirma a compra. Só compras DRAFT podem ser confirmadas
  /// (estado terminal depois disso). Emite PURCHASE_CONFIRMED_EVENT —
  /// nenhum efeito de estoque/financeiro é executado aqui diretamente
  /// (ver events/purchase-confirmed.event.ts).
  async confirm(id: string, actor: ActingUser) {
    const purchase = await this.findById(id, actor.organizationId);

    if (purchase.status !== 'DRAFT') {
      throw new UnprocessableEntityException(
        `Compra não pode ser confirmada: status atual é "${purchase.status}" (só compras em rascunho podem ser confirmadas).`,
      );
    }

    const confirmedAt = new Date();

    const updated = await this.prisma.$transaction(async (tx: typeof this.prisma) => {
      const result = await tx.purchase.update({
        where: { id },
        data: { status: 'CONFIRMED', confirmedByUserId: actor.id, confirmedAt },
        include: { items: true },
      });

      return result;
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'CONFIRM',
      entity: 'Purchase',
      entityId: id,
      previousValue: { status: purchase.status },
      newValue: { status: 'CONFIRMED' },
    });

    const event: PurchaseConfirmedEvent = {
      purchaseId: updated.id,
      organizationId: actor.organizationId,
      businessUnitId: updated.businessUnitId,
      supplierId: updated.supplierId,
      confirmedByUserId: actor.id,
      confirmedAt,
      totalAmount: updated.totalAmount.toString(),
      items: updated.items.map((item: any) => ({
        ingredientId: item.ingredientId,
        quantity: item.quantity.toString(),
        unit: item.unit,
        unitPrice: item.unitPrice.toString(),
        totalPrice: item.totalPrice.toString(),
      })),
    };
    this.eventEmitter.emit(PURCHASE_CONFIRMED_EVENT, event);

    return updated;
  }

  /// RF-014: cancela uma compra DRAFT. Nenhum efeito a desfazer, já que
  /// nada foi disparado ainda (compra nunca chegou a ser confirmada).
  async cancel(id: string, actor: ActingUser) {
    const purchase = await this.findById(id, actor.organizationId);

    if (purchase.status !== 'DRAFT') {
      throw new UnprocessableEntityException(
        `Compra não pode ser cancelada: status atual é "${purchase.status}" (só compras em rascunho podem ser canceladas).`,
      );
    }

    const updated = await this.prisma.purchase.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'CANCEL',
      entity: 'Purchase',
      entityId: id,
      previousValue: { status: purchase.status },
      newValue: { status: 'CANCELLED' },
    });

    return updated;
  }
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
