import { StockLossFinancialListener } from './stock-loss-financial.listener';
import { FinancialService } from './financial.service';
import { PrismaService } from '../prisma/prisma.service';
import { StockAdjustmentRegisteredEvent } from '../stock/events/stock-adjustment-registered.event';

describe('StockLossFinancialListener', () => {
  let listener: StockLossFinancialListener;
  let financialService: { createEntryFromStockLoss: jest.Mock };
  let prisma: any;

  beforeEach(() => {
    financialService = { createEntryFromStockLoss: jest.fn().mockResolvedValue({}) };
    prisma = { ingredient: { findUnique: jest.fn() } };

    listener = new StockLossFinancialListener(
      financialService as unknown as FinancialService,
      prisma as unknown as PrismaService,
    );
  });

  const baseEvent: StockAdjustmentRegisteredEvent = {
    organizationId: 'org-1',
    businessUnitId: 'bu-1',
    ingredientId: 'ing-1',
    direction: 'OUT',
    quantityStandardUnit: 0.5,
    reason: 'LOSS',
    performedByUserId: 'user-1',
  };

  it('EXEMPLO COMPLETO: cria lançamento de perda valorado pelo custo médio do ingrediente', async () => {
    prisma.ingredient.findUnique.mockResolvedValue({
      id: 'ing-1',
      name: 'Carne Bovina',
      standardUnit: 'kg',
      averageCost: '30',
    });

    await listener.handleStockAdjustment(baseEvent);

    expect(financialService.createEntryFromStockLoss).toHaveBeenCalledWith({
      organizationId: 'org-1',
      businessUnitId: 'bu-1',
      description: 'Perda de estoque — Carne Bovina (0.5 kg)',
      grossAmount: 15, // 0.5kg * R$30/kg
      createdByUserId: 'user-1',
    });
  });

  it('traduz o motivo pro rótulo em português na descrição', async () => {
    prisma.ingredient.findUnique.mockResolvedValue({
      id: 'ing-1',
      name: 'Queijo',
      standardUnit: 'kg',
      averageCost: '40',
    });

    await listener.handleStockAdjustment({ ...baseEvent, reason: 'CORRECTION' });

    const call = financialService.createEntryFromStockLoss.mock.calls[0][0];
    expect(call.description).toContain('Correção de estoque');
  });

  it('IGNORA ajustes de ENTRADA — não é compra nem perda', async () => {
    await listener.handleStockAdjustment({ ...baseEvent, direction: 'IN' });

    expect(prisma.ingredient.findUnique).not.toHaveBeenCalled();
    expect(financialService.createEntryFromStockLoss).not.toHaveBeenCalled();
  });

  it('NÃO cria lançamento quando o ingrediente não tem custo médio cadastrado (sem travar nada)', async () => {
    prisma.ingredient.findUnique.mockResolvedValue({
      id: 'ing-1',
      name: 'Ingrediente Novo',
      standardUnit: 'kg',
      averageCost: null,
    });

    await expect(listener.handleStockAdjustment(baseEvent)).resolves.toBeUndefined();
    expect(financialService.createEntryFromStockLoss).not.toHaveBeenCalled();
  });

  it('NÃO cria lançamento quando o ingrediente não é encontrado', async () => {
    prisma.ingredient.findUnique.mockResolvedValue(null);

    await expect(listener.handleStockAdjustment(baseEvent)).resolves.toBeUndefined();
    expect(financialService.createEntryFromStockLoss).not.toHaveBeenCalled();
  });
});
