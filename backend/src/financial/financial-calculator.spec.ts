import { calculateCashFlow, calculateDre } from './financial-calculator';

describe('calculateDre', () => {
  /**
   * EXEMPLO NUMÉRICO COMPLETO (RF-024):
   *
   * Receita bruta (recebido no período):     R$ 10.000,00
   * Taxas (PLATAFORMA — comissão iFood):     R$   1.200,00
   * Impostos (manual, simples nacional 6%):  R$     600,00
   * CMV (MATERIA_PRIMA):                     R$   3.000,00
   * ---------------------------------------------------------
   * Lucro bruto = 10000 - 1200 - 600 - 3000 = R$ 5.200,00
   *
   * Despesas operacionais:
   *   EMBALAGEM:      R$ 300,00
   *   ALUGUEL:        R$ 2.000,00
   *   ENERGIA:        R$ 400,00
   *   Total:          R$ 2.700,00
   * ---------------------------------------------------------
   * Resultado operacional = 5200 - 2700 = R$ 2.500,00
   */
  it('EXEMPLO COMPLETO: calcula o DRE gerencial corretamente', () => {
    const result = calculateDre({
      receivedEntries: [6000, 4000],
      payableByCategory: {
        PLATAFORMA: [1200],
        MATERIA_PRIMA: [1800, 1200],
        EMBALAGEM: [300],
        ALUGUEL: [2000],
        ENERGIA: [400],
      },
      impostos: 600,
    });

    expect(result.receitaBruta).toBe(10000);
    expect(result.taxas).toBe(1200);
    expect(result.impostos).toBe(600);
    expect(result.cmv).toBe(3000);
    expect(result.lucroBruto).toBe(5200);
    expect(result.despesasOperacionais).toBe(2700);
    expect(result.resultadoOperacional).toBe(2500);
  });

  it('trata categorias ausentes como zero (sem lançamento não gera erro)', () => {
    const result = calculateDre({ receivedEntries: [1000], payableByCategory: {} });

    expect(result.taxas).toBe(0);
    expect(result.cmv).toBe(0);
    expect(result.impostos).toBe(0); // PD-006 em aberto: sem cálculo automático
    expect(result.lucroBruto).toBe(1000);
    expect(result.resultadoOperacional).toBe(1000);
  });

  it('impostos default para zero quando não informado manualmente (PD-006 em aberto)', () => {
    const result = calculateDre({
      receivedEntries: [5000],
      payableByCategory: { MATERIA_PRIMA: [2000] },
    });

    expect(result.impostos).toBe(0);
  });
});

describe('calculateCashFlow', () => {
  it('calcula entradas, saídas e saldo do período', () => {
    const result = calculateCashFlow([1000, 2000], [500, 300]);

    expect(result.entradas).toBe(3000);
    expect(result.saidas).toBe(800);
    expect(result.saldo).toBe(2200);
  });

  it('saldo pode ser negativo quando saídas superam entradas', () => {
    const result = calculateCashFlow([100], [500]);

    expect(result.saldo).toBe(-400);
  });
});
