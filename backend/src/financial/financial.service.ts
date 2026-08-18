import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateFinancialEntryDto, UpdateFinancialEntryDto } from './dto/financial-entry.dto';
import { calculateCashFlow, calculateDre } from './financial-calculator';

interface ActingUser {
  id: string;
  organizationId: string;
}

export interface CreateEntryFromPurchaseInput {
  organizationId: string;
  businessUnitId: string;
  supplierId: string;
  purchaseId: string;
  grossAmount: number;
  createdByUserId: string;
}

@Injectable()
export class FinancialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateFinancialEntryDto, actor: ActingUser) {
    const businessUnit = await this.prisma.businessUnit.findFirst({
      where: { id: dto.businessUnitId, organizationId: actor.organizationId },
    });
    if (!businessUnit) {
      throw new NotFoundException('Unidade de negócio não encontrada.');
    }

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, organizationId: actor.organizationId },
      });
      if (!supplier) {
        throw new NotFoundException('Fornecedor não encontrado.');
      }
    }

    const created = await this.prisma.financialEntry.create({
      data: {
        organizationId: actor.organizationId,
        businessUnitId: dto.businessUnitId,
        type: dto.type,
        category: dto.category,
        description: dto.description,
        supplierId: dto.supplierId,
        grossAmount: dto.grossAmount,
        netAmount: dto.netAmount,
        dueDate: dto.dueDate,
        createdByUserId: actor.id,
      },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'CREATE',
      entity: 'FinancialEntry',
      entityId: created.id,
      newValue: created,
    });

    return created;
  }

  /// BR-007: cria automaticamente o lançamento associado a uma compra
  /// confirmada. Chamado pelo FinancialPurchaseListener — nunca pelo
  /// usuário diretamente.
  async createEntryFromPurchase(input: CreateEntryFromPurchaseInput) {
    return this.prisma.financialEntry.create({
      data: {
        organizationId: input.organizationId,
        businessUnitId: input.businessUnitId,
        type: 'PAYABLE',
        category: 'MATERIA_PRIMA',
        description: `Compra confirmada #${input.purchaseId}`,
        supplierId: input.supplierId,
        purchaseId: input.purchaseId,
        grossAmount: input.grossAmount,
        createdByUserId: input.createdByUserId,
      },
    });
  }

  async findAll(organizationId: string, businessUnitId?: string) {
    return this.prisma.financialEntry.findMany({
      where: { organizationId, businessUnitId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, organizationId: string) {
    const entry = await this.prisma.financialEntry.findFirst({ where: { id, organizationId } });
    if (!entry) {
      throw new NotFoundException('Lançamento financeiro não encontrado.');
    }
    return entry;
  }

  async update(id: string, dto: UpdateFinancialEntryDto, actor: ActingUser) {
    const before = await this.findById(id, actor.organizationId);
    if (before.status !== 'PENDING') {
      throw new UnprocessableEntityException(
        `Lançamento não pode ser editado: status atual é "${before.status}" (só lançamentos pendentes podem ser editados).`,
      );
    }

    const updated = await this.prisma.financialEntry.update({ where: { id }, data: dto });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'UPDATE',
      entity: 'FinancialEntry',
      entityId: id,
      previousValue: before,
      newValue: updated,
    });

    return updated;
  }

  async markAsPaid(id: string, actor: ActingUser, settledAt?: Date) {
    const before = await this.findById(id, actor.organizationId);
    if (before.status !== 'PENDING' && before.status !== 'OVERDUE') {
      throw new UnprocessableEntityException(
        `Lançamento não pode ser liquidado: status atual é "${before.status}".`,
      );
    }

    const updated = await this.prisma.financialEntry.update({
      where: { id },
      data: { status: 'PAID', settledAt: settledAt ?? new Date() },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'MARK_AS_PAID',
      entity: 'FinancialEntry',
      entityId: id,
      previousValue: { status: before.status },
      newValue: { status: 'PAID', settledAt: updated.settledAt },
    });

    return updated;
  }

  async cancel(id: string, actor: ActingUser) {
    const before = await this.findById(id, actor.organizationId);
    if (before.status === 'PAID') {
      throw new UnprocessableEntityException('Lançamento já liquidado não pode ser cancelado.');
    }

    const updated = await this.prisma.financialEntry.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'CANCEL',
      entity: 'FinancialEntry',
      entityId: id,
      previousValue: { status: before.status },
      newValue: { status: 'CANCELLED' },
    });

    return updated;
  }

  /// RF-020: fluxo de caixa — soma de entradas/saídas EFETIVAMENTE
  /// liquidadas (settledAt) no período informado.
  async getCashFlow(businessUnitId: string, organizationId: string, from: Date, to: Date) {
    await this.ensureBusinessUnitBelongsToOrg(businessUnitId, organizationId);

    const settled = await this.prisma.financialEntry.findMany({
      where: {
        businessUnitId,
        status: 'PAID',
        settledAt: { gte: from, lte: to },
      },
    });

    const received = settled
      .filter((e: any) => e.type === 'RECEIVABLE')
      .map((e: any) => Number(e.grossAmount));
    const paid = settled
      .filter((e: any) => e.type === 'PAYABLE')
      .map((e: any) => Number(e.grossAmount));

    return { from, to, ...calculateCashFlow(received, paid) };
  }

  /// RF-024/BR-016: DRE gerencial derivado de lançamentos liquidados e
  /// categorizados no período. `impostos` é opcional e manual — PD-006
  /// (regime tributário) não está definido.
  async getDre(businessUnitId: string, organizationId: string, from: Date, to: Date, impostos = 0) {
    await this.ensureBusinessUnitBelongsToOrg(businessUnitId, organizationId);

    const settled = await this.prisma.financialEntry.findMany({
      where: {
        businessUnitId,
        status: 'PAID',
        settledAt: { gte: from, lte: to },
      },
    });

    const receivedEntries = settled
      .filter((e: any) => e.type === 'RECEIVABLE')
      .map((e: any) => Number(e.grossAmount));

    const payableByCategory: Record<string, number[]> = {};
    for (const entry of settled.filter((e: any) => e.type === 'PAYABLE')) {
      const category = (entry as any).category as string;
      payableByCategory[category] = payableByCategory[category] ?? [];
      payableByCategory[category].push(Number((entry as any).grossAmount));
    }

    return { from, to, ...calculateDre({ receivedEntries, payableByCategory, impostos }) };
  }

  private async ensureBusinessUnitBelongsToOrg(businessUnitId: string, organizationId: string) {
    const businessUnit = await this.prisma.businessUnit.findFirst({
      where: { id: businessUnitId, organizationId },
    });
    if (!businessUnit) {
      throw new NotFoundException('Unidade de negócio não encontrada.');
    }
  }
}
