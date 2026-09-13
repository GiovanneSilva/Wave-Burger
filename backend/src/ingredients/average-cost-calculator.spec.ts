import { calculateWeightedAverageCost } from './average-cost-calculator';

describe('calculateWeightedAverageCost', () => {
  /**
   * EXEMPLO COMPLETO: Carne Bovina tem 2kg em estoque a R$28,00/kg
   * (valor do estoque anterior: R$56,00). Chega uma compra nova de 3kg
   * a R$32,00/kg (valor desta compra: R$96,00).
   *
   * Novo custo médio = (56 + 96) / (2 + 3) = 152 / 5 = R$30,40/kg
   */
  it('EXEMPLO COMPLETO: pondera o custo anterior pela quantidade anterior', () => {
    const result = calculateWeightedAverageCost({
      previousQuantity: 2,
      previousAverageCost: 28,
      purchaseQuantity: 3,
      purchaseTotalValue: 96, // 3kg x R$32,00
    });

    expect(result).toBeCloseTo(30.4, 4);
  });

  it('primeira compra de todas — ingrediente sem custo médio prévio (null) é tratado como estoque zerado sem valor', () => {
    const result = calculateWeightedAverageCost({
      previousQuantity: 0,
      previousAverageCost: null,
      purchaseQuantity: 5,
      purchaseTotalValue: 150, // 5kg x R$30,00
    });

    expect(result).toBe(30);
  });

  it('ingrediente com custo médio prévio mas estoque físico zerado (esgotou antes desta compra)', () => {
    const result = calculateWeightedAverageCost({
      previousQuantity: 0,
      previousAverageCost: 28, // custo antigo, mas não sobrou quantidade nenhuma
      purchaseQuantity: 3,
      purchaseTotalValue: 96,
    });

    // sem quantidade anterior, o custo antigo não pesa nada — só o desta compra
    expect(result).toBe(32);
  });

  it('compra na mesma quantidade e preço do estoque anterior mantém o custo médio igual', () => {
    const result = calculateWeightedAverageCost({
      previousQuantity: 5,
      previousAverageCost: 30,
      purchaseQuantity: 5,
      purchaseTotalValue: 150, // mesmo R$30/un.
    });

    expect(result).toBe(30);
  });

  it('quantidade grande já em estoque dilui bastante o efeito de uma compra pequena', () => {
    const result = calculateWeightedAverageCost({
      previousQuantity: 100,
      previousAverageCost: 20,
      purchaseQuantity: 1,
      purchaseTotalValue: 100, // comprou 1un a R$100 (bem mais caro)
    });

    // (100*20 + 1*100) / 101 = 2100/101 ≈ 20,79 — pouco impacto
    expect(result).toBeCloseTo(20.7921, 4);
  });
});
