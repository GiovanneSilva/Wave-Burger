import { UnprocessableEntityException } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FichaTecnicaValidator } from './ficha-tecnica.validator';

/**
 * Prova de integração da Etapa 10: BR-001 ("produto não pode ser ativado
 * sem ficha técnica válida") agora é verificado de verdade.
 *
 * Na Etapa 9, PendingFichaTecnicaValidator sempre negava — nenhum produto
 * podia ser ativado. Aqui usamos a implementação REAL (FichaTecnicaValidator)
 * conectada ao ProductsService, provando que:
 * 1. Sem ficha técnica corrente -> ativação continua bloqueada.
 * 2. Com ficha técnica corrente válida -> ativação passa a funcionar.
 */
describe('BR-001 fim a fim: ProductsService + FichaTecnicaValidator real', () => {
  let productsService: ProductsService;
  let prisma: {
    product: { findFirst: jest.Mock; update: jest.Mock };
    fichaTecnica: { findFirst: jest.Mock };
  };
  let audit: { record: jest.Mock };

  const actor = { id: 'user-1', organizationId: 'org-1' };

  beforeEach(() => {
    prisma = {
      product: { findFirst: jest.fn(), update: jest.fn() },
      fichaTecnica: { findFirst: jest.fn() },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const realValidator = new FichaTecnicaValidator(prisma as unknown as PrismaService);
    productsService = new ProductsService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      realValidator,
    );
  });

  it('BLOQUEIA ativação quando o produto não tem nenhuma ficha técnica', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: 'prod-1', status: 'DRAFT' });
    prisma.fichaTecnica.findFirst.mockResolvedValue(null);

    await expect(productsService.activate('prod-1', actor)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('PERMITE ativação quando o produto tem uma ficha técnica corrente com itens', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: 'prod-1', status: 'DRAFT' });
    prisma.fichaTecnica.findFirst.mockResolvedValue({ id: 'ft-1', _count: { items: 5 } });
    prisma.product.update.mockResolvedValue({ id: 'prod-1', status: 'ACTIVE' });

    const result = await productsService.activate('prod-1', actor);

    expect(result.status).toBe('ACTIVE');
  });
});
