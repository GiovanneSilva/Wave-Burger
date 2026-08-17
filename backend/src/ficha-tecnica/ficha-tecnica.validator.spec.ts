import { FichaTecnicaValidator } from './ficha-tecnica.validator';
import { PrismaService } from '../prisma/prisma.service';

describe('FichaTecnicaValidator (BR-001, implementação real)', () => {
  let validator: FichaTecnicaValidator;
  let prisma: { fichaTecnica: { findFirst: jest.Mock } };

  beforeEach(() => {
    prisma = { fichaTecnica: { findFirst: jest.fn() } };
    validator = new FichaTecnicaValidator(prisma as unknown as PrismaService);
  });

  it('retorna true quando existe versão corrente com itens', async () => {
    prisma.fichaTecnica.findFirst.mockResolvedValue({ id: 'ft-1', _count: { items: 3 } });

    await expect(validator.hasValidFichaTecnica('prod-1')).resolves.toBe(true);
  });

  it('retorna false quando não existe nenhuma ficha técnica para o produto', async () => {
    prisma.fichaTecnica.findFirst.mockResolvedValue(null);

    await expect(validator.hasValidFichaTecnica('prod-1')).resolves.toBe(false);
  });

  it('retorna false quando a versão corrente existe mas não tem itens (defesa em profundidade de BR-002)', async () => {
    prisma.fichaTecnica.findFirst.mockResolvedValue({ id: 'ft-1', _count: { items: 0 } });

    await expect(validator.hasValidFichaTecnica('prod-1')).resolves.toBe(false);
  });
});
