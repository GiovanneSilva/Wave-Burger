import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateIngredientDto, UpdateIngredientDto } from './dto/ingredient.dto';

interface ActingUser {
  id: string;
  organizationId: string;
}

@Injectable()
export class IngredientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateIngredientDto, actor: ActingUser) {
    const existing = await this.prisma.ingredient.findFirst({
      where: { organizationId: actor.organizationId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException('Já existe um ingrediente com este nome nesta organização.');
    }

    const created = await this.prisma.ingredient.create({
      data: {
        organizationId: actor.organizationId,
        name: dto.name,
        category: dto.category,
        standardUnit: dto.standardUnit,
        storageLocation: dto.storageLocation,
        minimumStock: dto.minimumStock,
        averageCost: dto.averageCost,
        lastCost: dto.lastCost,
      },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'CREATE',
      entity: 'Ingredient',
      entityId: created.id,
      newValue: created,
    });

    return created;
  }

  async findAll(organizationId: string) {
    return this.prisma.ingredient.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, organizationId: string) {
    const ingredient = await this.prisma.ingredient.findFirst({
      where: { id, organizationId },
    });
    if (!ingredient) {
      throw new NotFoundException('Ingrediente não encontrado.');
    }
    return ingredient;
  }

  async update(id: string, dto: UpdateIngredientDto, actor: ActingUser) {
    const before = await this.findById(id, actor.organizationId);

    if (dto.name && dto.name !== before.name) {
      const nameTaken = await this.prisma.ingredient.findFirst({
        where: { organizationId: actor.organizationId, name: dto.name, NOT: { id } },
      });
      if (nameTaken) {
        throw new ConflictException('Já existe um ingrediente com este nome nesta organização.');
      }
    }

    const costChanged =
      (dto.averageCost !== undefined && dto.averageCost !== before.averageCost?.toString()) ||
      (dto.lastCost !== undefined && dto.lastCost !== before.lastCost?.toString());

    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        standardUnit: dto.standardUnit,
        storageLocation: dto.storageLocation,
        minimumStock: dto.minimumStock,
        averageCost: dto.averageCost,
        lastCost: dto.lastCost,
        ...(costChanged ? { lastPurchaseDate: new Date() } : {}),
      },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'UPDATE',
      entity: 'Ingredient',
      entityId: id,
      previousValue: before,
      newValue: updated,
      metadata: costChanged
        ? {
            note: 'Custo alterado. Recalculo de produtos afetados (BR-004) ainda não implementado — depende do módulo de Ficha Técnica (Etapa 10).',
          }
        : undefined,
    });

    return updated;
  }

  /// Inativa o ingrediente — nunca exclusão física (RF-003, aplicado por
  /// consistência arquitetural a Ingrediente).
  async deactivate(id: string, actor: ActingUser) {
    const before = await this.findById(id, actor.organizationId);
    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'DEACTIVATE',
      entity: 'Ingredient',
      entityId: id,
      previousValue: before,
      newValue: updated,
    });

    return updated;
  }

  async activate(id: string, actor: ActingUser) {
    const before = await this.findById(id, actor.organizationId);
    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: { isActive: true },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'ACTIVATE',
      entity: 'Ingredient',
      entityId: id,
      previousValue: before,
      newValue: updated,
    });

    return updated;
  }
}
