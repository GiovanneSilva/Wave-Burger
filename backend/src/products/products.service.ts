import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import {
  FICHA_TECNICA_VALIDATION_PORT,
  FichaTecnicaValidationPort,
} from './ficha-tecnica-validation.port';

interface ActingUser {
  id: string;
  organizationId: string;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(FICHA_TECNICA_VALIDATION_PORT)
    private readonly fichaTecnicaValidator: FichaTecnicaValidationPort,
  ) {}

  /// UC-001: produto é sempre criado inicialmente como rascunho (DRAFT).
  async create(dto: CreateProductDto, actor: ActingUser) {
    await this.ensureNameAndCodeAvailable(actor.organizationId, dto.name, dto.internalCode);

    const created = await this.prisma.product.create({
      data: {
        organizationId: actor.organizationId,
        name: dto.name,
        internalCode: dto.internalCode,
        category: dto.category,
        description: dto.description,
        imageUrl: dto.imageUrl,
        salePrice: dto.salePrice,
        promotionalPrice: dto.promotionalPrice,
        promotionalPeriodStart: dto.promotionalPeriodStart,
        promotionalPeriodEnd: dto.promotionalPeriodEnd,
        finalWeight: dto.finalWeight,
        averagePrepTimeMinutes: dto.averagePrepTimeMinutes,
        isAvailable: dto.isAvailable ?? true,
        status: 'DRAFT',
      },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'CREATE',
      entity: 'Product',
      entityId: created.id,
      newValue: created,
    });

    return created;
  }

  async findAll(organizationId: string) {
    return this.prisma.product.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, organizationId: string) {
    const product = await this.prisma.product.findFirst({ where: { id, organizationId } });
    if (!product) {
      throw new NotFoundException('Produto não encontrado.');
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto, actor: ActingUser) {
    const before = await this.findById(id, actor.organizationId);

    if (
      (dto.name && dto.name !== before.name) ||
      (dto.internalCode && dto.internalCode !== before.internalCode)
    ) {
      await this.ensureNameAndCodeAvailable(
        actor.organizationId,
        dto.name ?? before.name,
        dto.internalCode ?? before.internalCode ?? undefined,
        id,
      );
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        internalCode: dto.internalCode,
        category: dto.category,
        description: dto.description,
        imageUrl: dto.imageUrl,
        salePrice: dto.salePrice,
        promotionalPrice: dto.promotionalPrice,
        promotionalPeriodStart: dto.promotionalPeriodStart,
        promotionalPeriodEnd: dto.promotionalPeriodEnd,
        finalWeight: dto.finalWeight,
        averagePrepTimeMinutes: dto.averagePrepTimeMinutes,
        isAvailable: dto.isAvailable,
      },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'UPDATE',
      entity: 'Product',
      entityId: id,
      previousValue: before,
      newValue: updated,
    });

    return updated;
  }

  /// BR-001: bloqueia ativação sem ficha técnica válida. Enquanto a Etapa
  /// 10 não existir, FichaTecnicaValidationPort sempre nega — logo esta
  /// operação sempre falha por enquanto, por design.
  async activate(id: string, actor: ActingUser) {
    const before = await this.findById(id, actor.organizationId);

    const hasValidFichaTecnica = await this.fichaTecnicaValidator.hasValidFichaTecnica(id);
    if (!hasValidFichaTecnica) {
      throw new UnprocessableEntityException(
        'Produto não pode ser ativado: nenhuma ficha técnica válida encontrada (BR-001).',
      );
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'ACTIVATE',
      entity: 'Product',
      entityId: id,
      previousValue: before,
      newValue: updated,
    });

    return updated;
  }

  /// RF-003: produto é inativado, nunca excluído fisicamente — histórico
  /// preservado. Inativação não depende de ficha técnica (BR-001 só se
  /// aplica à ativação).
  async deactivate(id: string, actor: ActingUser) {
    const before = await this.findById(id, actor.organizationId);
    const updated = await this.prisma.product.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'DEACTIVATE',
      entity: 'Product',
      entityId: id,
      previousValue: before,
      newValue: updated,
    });

    return updated;
  }

  private async ensureNameAndCodeAvailable(
    organizationId: string,
    name: string,
    internalCode: string | undefined,
    excludeId?: string,
  ) {
    const nameTaken = await this.prisma.product.findFirst({
      where: { organizationId, name, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    });
    if (nameTaken) {
      throw new ConflictException('Já existe um produto com este nome nesta organização.');
    }

    if (internalCode) {
      const codeTaken = await this.prisma.product.findFirst({
        where: {
          organizationId,
          internalCode,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
      });
      if (codeTaken) {
        throw new ConflictException(
          'Já existe um produto com este código interno nesta organização.',
        );
      }
    }
  }
}
