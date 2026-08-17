import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const roles = dto.roleNames?.length
      ? await this.prisma.role.findMany({ where: { name: { in: dto.roleNames } } })
      : [];

    return this.prisma.user.create({
      data: {
        organizationId: dto.organizationId,
        businessUnitId: dto.businessUnitId,
        name: dto.name,
        email: dto.email,
        passwordHash,
        roles: {
          create: roles.map((role: { id: string }) => ({ roleId: role.id })),
        },
      },
      select: this.safeSelect(),
    });
  }

  async findAll() {
    return this.prisma.user.findMany({ select: this.safeSelect() });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: this.safeSelect() });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return user;
  }

  async findByEmailWithAuth(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id);
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: this.safeSelect(),
    });
  }

  /// Inativa o usuário (nunca exclusão física — mesmo princípio de RF-003).
  async deactivate(id: string) {
    await this.findById(id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: this.safeSelect(),
    });
  }

  private safeSelect() {
    return {
      id: true,
      organizationId: true,
      businessUnitId: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }
}
