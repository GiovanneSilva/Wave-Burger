import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { FichaTecnicaService } from './ficha-tecnica.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('FichaTecnicaService', () => {
  let service: FichaTecnicaService;
  let prisma: any;
  let audit: { record: jest.Mock };

  const actor = { id: 'user-1', organizationId: 'org-1' };

  const activeIngredient = (overrides: Record<string, unknown> = {}) => ({
    id: 'ing-carne',
    name: 'Carne Bovina',
    standardUnit: 'kg',
    averageCost: '30.0000',
    isActive: true,
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      product: { findFirst: jest.fn(), findFirstOrThrow: jest.fn() },
      ingredient: { findMany: jest.fn() },
      fichaTecnica: { findFirst: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new FichaTecnicaService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  describe('createNewVersion', () => {
    it('cria a versão 1 quando o produto ainda não tem ficha técnica', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'prod-1', salePrice: '28.90' });
      prisma.ingredient.findMany.mockResolvedValue([activeIngredient()]);
      prisma.fichaTecnica.findFirst.mockResolvedValue(null); // sem versão corrente

      const txClient = {
        fichaTecnica: {
          update: jest.fn(),
          create: jest.fn().mockResolvedValue({ id: 'ft-1', version: 1, items: [] }),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(txClient));

      const result = await service.createNewVersion(
        'prod-1',
        {
          items: [{ ingredientId: 'ing-carne', quantity: '160', unit: 'g', lossPercentage: 0 }],
        } as any,
        actor,
      );

      expect(result.version).toBe(1);
      expect(txClient.fichaTecnica.update).not.toHaveBeenCalled(); // nada a desativar na v1
      expect(txClient.fichaTecnica.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version: 1,
            isCurrent: true,
            ingredientsCost: 4.8,
          }),
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_VERSION', entity: 'FichaTecnica' }),
      );
    });

    it('cria a versão 2 e desativa a versão 1 anterior (BR-005, versionamento)', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'prod-1', salePrice: '28.90' });
      prisma.ingredient.findMany.mockResolvedValue([activeIngredient()]);
      prisma.fichaTecnica.findFirst.mockResolvedValue({ id: 'ft-1', version: 1 });

      const txClient = {
        fichaTecnica: {
          update: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockResolvedValue({ id: 'ft-2', version: 2, items: [] }),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(txClient));

      const result = await service.createNewVersion(
        'prod-1',
        {
          items: [{ ingredientId: 'ing-carne', quantity: '180', unit: 'g', lossPercentage: 0 }],
        } as any,
        actor,
      );

      expect(result.version).toBe(2);
      expect(txClient.fichaTecnica.update).toHaveBeenCalledWith({
        where: { id: 'ft-1' },
        data: { isCurrent: false },
      });
      expect(txClient.fichaTecnica.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ version: 2, isCurrent: true }) }),
      );
    });

    it('REJEITA ingrediente inativo (UC-002, fluxo alternativo)', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'prod-1', salePrice: '28.90' });
      prisma.ingredient.findMany.mockResolvedValue([activeIngredient({ isActive: false })]);
      prisma.fichaTecnica.findFirst.mockResolvedValue(null);

      await expect(
        service.createNewVersion(
          'prod-1',
          { items: [{ ingredientId: 'ing-carne', quantity: '160', unit: 'g' }] } as any,
          actor,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('REJEITA ingrediente sem custo médio cadastrado', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'prod-1', salePrice: '28.90' });
      prisma.ingredient.findMany.mockResolvedValue([activeIngredient({ averageCost: null })]);
      prisma.fichaTecnica.findFirst.mockResolvedValue(null);

      await expect(
        service.createNewVersion(
          'prod-1',
          { items: [{ ingredientId: 'ing-carne', quantity: '160', unit: 'g' }] } as any,
          actor,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('lança NotFoundException quando o produto não existe na organização', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(
        service.createNewVersion(
          'prod-x',
          { items: [{ ingredientId: 'ing-carne', quantity: '160', unit: 'g' }] } as any,
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCurrentCostSummary — BR-004', () => {
    it('detecta divergência entre custo congelado e custo atual do ingrediente', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'prod-1', organizationId: 'org-1' });
      prisma.product.findFirstOrThrow.mockResolvedValue({ id: 'prod-1', salePrice: '28.90' });
      prisma.fichaTecnica.findFirst.mockResolvedValue({
        version: 1,
        ingredientsCost: '4.8000',
        totalCost: '4.8000',
        cmvPercentage: '16.6090',
        markup: '6.0208',
        marginPercentage: '83.3910',
        estimatedProfit: '24.1000',
        items: [
          {
            quantity: '160',
            unit: 'g',
            lossPercentage: '0',
            ingredient: { standardUnit: 'kg', averageCost: '35.0000' }, // custo SUBIU desde a versão
          },
        ],
      });

      const result = await service.getCurrentCostSummary('prod-1', 'org-1');

      expect(result.frozenAtVersionCreation.totalCost).toBe('4.8000');
      expect(result.currentLive.totalCost).toBeCloseTo(5.6, 4); // 0.16kg * 35
      expect(result.costDrifted).toBe(true);
    });

    it('reporta costDrifted=false quando o custo não mudou', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'prod-1', organizationId: 'org-1' });
      prisma.product.findFirstOrThrow.mockResolvedValue({ id: 'prod-1', salePrice: '28.90' });
      prisma.fichaTecnica.findFirst.mockResolvedValue({
        version: 1,
        ingredientsCost: 4.8,
        totalCost: 4.8,
        cmvPercentage: null,
        markup: null,
        marginPercentage: null,
        estimatedProfit: null,
        items: [
          {
            quantity: '160',
            unit: 'g',
            lossPercentage: '0',
            ingredient: { standardUnit: 'kg', averageCost: '30.0000' },
          },
        ],
      });

      const result = await service.getCurrentCostSummary('prod-1', 'org-1');

      expect(result.costDrifted).toBe(false);
    });
  });
});
