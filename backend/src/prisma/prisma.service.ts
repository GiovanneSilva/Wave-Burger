import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Wrapper do PrismaClient integrado ao ciclo de vida do NestJS.
 * Único ponto de acesso ao banco — nenhum módulo de negócio deve
 * instanciar PrismaClient diretamente (claude/CLAUDE.md, Seção 4).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
