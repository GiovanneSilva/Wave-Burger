import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FichaTecnicaValidationPort } from '../products/ficha-tecnica-validation.port';

/**
 * Implementação REAL de BR-001, substituindo PendingFichaTecnicaValidator
 * (Etapa 9). Um produto tem ficha técnica válida quando possui uma versão
 * corrente (isCurrent=true) com pelo menos um item — BR-002 já é
 * reforçado na criação (FichaTecnicaService.createNewVersion), então a
 * checagem de item aqui é defesa em profundidade.
 */
@Injectable()
export class FichaTecnicaValidator implements FichaTecnicaValidationPort {
  constructor(private readonly prisma: PrismaService) {}

  async hasValidFichaTecnica(productId: string): Promise<boolean> {
    const current = await this.prisma.fichaTecnica.findFirst({
      where: { productId, isCurrent: true },
      include: { _count: { select: { items: true } } },
    });

    return Boolean(current && current._count.items > 0);
  }
}
