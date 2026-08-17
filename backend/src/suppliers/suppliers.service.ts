import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

interface ActingUser {
  id: string;
  organizationId: string;
}

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateSupplierDto, actor: ActingUser) {
    const existing = await this.prisma.supplier.findFirst({
      where: { organizationId: actor.organizationId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException('Já existe um fornecedor com este nome nesta organização.');
    }

    const created = await this.prisma.supplier.create({
      data: { organizationId: actor.organizationId, ...dto },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'CREATE',
      entity: 'Supplier',
      entityId: created.id,
      newValue: created,
    });

    return created;
  }

  async findAll(organizationId: string) {
    return this.prisma.supplier.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, organizationId: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, organizationId } });
    if (!supplier) {
      throw new NotFoundException('Fornecedor não encontrado.');
    }
    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto, actor: ActingUser) {
    const before = await this.findById(id, actor.organizationId);

    if (dto.name && dto.name !== before.name) {
      const nameTaken = await this.prisma.supplier.findFirst({
        where: { organizationId: actor.organizationId, name: dto.name, NOT: { id } },
      });
      if (nameTaken) {
        throw new ConflictException('Já existe um fornecedor com este nome nesta organização.');
      }
    }

    const updated = await this.prisma.supplier.update({ where: { id }, data: dto });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'UPDATE',
      entity: 'Supplier',
      entityId: id,
      previousValue: before,
      newValue: updated,
    });

    return updated;
  }

  /// Nunca exclusão física — mesma consistência arquitetural das demais
  /// entidades operacionais (Ingredient, Product).
  async deactivate(id: string, actor: ActingUser) {
    const before = await this.findById(id, actor.organizationId);
    const updated = await this.prisma.supplier.update({ where: { id }, data: { isActive: false } });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'DEACTIVATE',
      entity: 'Supplier',
      entityId: id,
      previousValue: before,
      newValue: updated,
    });

    return updated;
  }

  async activate(id: string, actor: ActingUser) {
    const before = await this.findById(id, actor.organizationId);
    const updated = await this.prisma.supplier.update({ where: { id }, data: { isActive: true } });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'ACTIVATE',
      entity: 'Supplier',
      entityId: id,
      previousValue: before,
      newValue: updated,
    });

    return updated;
  }

  /// RF-012: relaciona fornecedor e ingrediente. Se isPreferred=true,
  /// desmarca qualquer outro fornecedor preferencial do mesmo ingrediente
  /// dentro de uma transação — só um preferencial por ingrediente
  /// (reforçado também por índice único parcial no banco).
  async linkIngredient(
    supplierId: string,
    dto: { ingredientId: string; isPreferred?: boolean },
    actor: ActingUser,
  ) {
    await this.findById(supplierId, actor.organizationId);
    const ingredient = await this.prisma.ingredient.findFirst({
      where: { id: dto.ingredientId, organizationId: actor.organizationId },
    });
    if (!ingredient) {
      throw new NotFoundException('Ingrediente não encontrado.');
    }

    const isPreferred = dto.isPreferred ?? false;

    const link = await this.prisma.$transaction(async (tx: typeof this.prisma) => {
      if (isPreferred) {
        await tx.supplierIngredient.updateMany({
          where: { ingredientId: dto.ingredientId, isPreferred: true },
          data: { isPreferred: false },
        });
      }

      return tx.supplierIngredient.upsert({
        where: { supplierId_ingredientId: { supplierId, ingredientId: dto.ingredientId } },
        update: { isPreferred },
        create: { supplierId, ingredientId: dto.ingredientId, isPreferred },
      });
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: isPreferred ? 'LINK_INGREDIENT_PREFERRED' : 'LINK_INGREDIENT',
      entity: 'Supplier',
      entityId: supplierId,
      newValue: link,
      metadata: { ingredientId: dto.ingredientId, isPreferred },
    });

    return link;
  }

  async unlinkIngredient(supplierId: string, ingredientId: string, actor: ActingUser) {
    await this.findById(supplierId, actor.organizationId);

    const link = await this.prisma.supplierIngredient.findUnique({
      where: { supplierId_ingredientId: { supplierId, ingredientId } },
    });
    if (!link) {
      throw new NotFoundException('Este fornecedor não está vinculado a este ingrediente.');
    }

    await this.prisma.supplierIngredient.delete({
      where: { supplierId_ingredientId: { supplierId, ingredientId } },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'UNLINK_INGREDIENT',
      entity: 'Supplier',
      entityId: supplierId,
      previousValue: link,
      metadata: { ingredientId },
    });

    return { unlinked: true };
  }

  async findIngredientsBySupplier(supplierId: string, organizationId: string) {
    await this.findById(supplierId, organizationId);
    return this.prisma.supplierIngredient.findMany({
      where: { supplierId },
      include: { ingredient: true },
    });
  }

  async findSuppliersByIngredient(ingredientId: string, organizationId: string) {
    const ingredient = await this.prisma.ingredient.findFirst({
      where: { id: ingredientId, organizationId },
    });
    if (!ingredient) {
      throw new NotFoundException('Ingrediente não encontrado.');
    }
    return this.prisma.supplierIngredient.findMany({
      where: { ingredientId },
      include: { supplier: true },
      orderBy: { isPreferred: 'desc' },
    });
  }
}
