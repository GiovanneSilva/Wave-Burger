import { calculateItemCost, calculateTotals } from './ficha-tecnica-calculator';

describe('calculateItemCost', () => {
  it('reproduz o exemplo exato do RF-005: 5kg de carne = R$150 -> R$30/kg -> 160g = R$4,80', () => {
    const result = calculateItemCost({
      quantity: 160,
      unit: 'g',
      ingredientStandardUnit: 'kg',
      lossPercentage: 0,
      costPerStandardUnit: 30, // R$150 / 5kg
    });

    expect(result.lineCost).toBeCloseTo(4.8, 4);
  });

  it('aplica a perda estimada (RF-004) inflando a quantidade efetiva', () => {
    // 160g com 10% de perda -> quantidade efetiva 176g -> 0.176kg * R$30 = R$5,28
    const result = calculateItemCost({
      quantity: 160,
      unit: 'g',
      ingredientStandardUnit: 'kg',
      lossPercentage: 10,
      costPerStandardUnit: 30,
    });

    expect(result.lineCost).toBeCloseTo(5.28, 4);
  });

  it('calcula corretamente quando a unidade já é a mesma do ingrediente', () => {
    const result = calculateItemCost({
      quantity: 1,
      unit: 'un',
      ingredientStandardUnit: 'un',
      lossPercentage: 0,
      costPerStandardUnit: 0.5,
    });

    expect(result.lineCost).toBeCloseTo(0.5, 4);
  });
});

describe('calculateTotals', () => {
  /**
   * EXEMPLO MATEMÁTICO COMPLETO (exigido pela Etapa 10) — Smash Burger,
   * baseado na composição conceitual do Documento Mestre (Seção RF-004):
   * pão, carne, queijo, molho, embalagem.
   *
   * Custos por unidade padrão (ilustrativos, para fins de teste):
   *  - Pão:       R$ 1,50 / un
   *  - Carne:     R$ 30,00 / kg  (exemplo oficial do RF-005)
   *  - Queijo:    R$ 40,00 / kg
   *  - Molho:     R$ 20,00 / l
   *  - Embalagem: R$ 0,80 / un
   *
   * Composição da ficha:
   *  - Pão:       1 un
   *  - Carne:     160 g  (0,16 kg)
   *  - Queijo:    40 g   (0,04 kg)
   *  - Molho:     20 ml  (0,02 l)
   *  - Embalagem: 1 un
   */
  it('EXEMPLO COMPLETO: Smash Burger — custo, CMV, markup, margem e lucro', () => {
    const items = [
      calculateItemCost({
        quantity: 1,
        unit: 'un',
        ingredientStandardUnit: 'un',
        lossPercentage: 0,
        costPerStandardUnit: 1.5,
      }), // Pão: R$ 1,50
      calculateItemCost({
        quantity: 160,
        unit: 'g',
        ingredientStandardUnit: 'kg',
        lossPercentage: 0,
        costPerStandardUnit: 30,
      }), // Carne: R$ 4,80
      calculateItemCost({
        quantity: 40,
        unit: 'g',
        ingredientStandardUnit: 'kg',
        lossPercentage: 0,
        costPerStandardUnit: 40,
      }), // Queijo: R$ 1,60
      calculateItemCost({
        quantity: 20,
        unit: 'ml',
        ingredientStandardUnit: 'l',
        lossPercentage: 0,
        costPerStandardUnit: 20,
      }), // Molho: R$ 0,40
      calculateItemCost({
        quantity: 1,
        unit: 'un',
        ingredientStandardUnit: 'un',
        lossPercentage: 0,
        costPerStandardUnit: 0.8,
      }), // Embalagem: R$ 0,80
    ];

    const lineCosts = items.map((i) => i.lineCost);
    // Custo total esperado: 1.50 + 4.80 + 1.60 + 0.40 + 0.80 = R$ 9,10
    expect(lineCosts).toEqual([1.5, 4.8, 1.6, 0.4, 0.8]);

    const salePrice = 28.9;
    const totals = calculateTotals(lineCosts, salePrice);

    expect(totals.ingredientsCost).toBeCloseTo(9.1, 4);
    expect(totals.totalCost).toBeCloseTo(9.1, 4);
    // CMV% = 9.10 / 28.90 * 100 ≈ 31.4879%
    expect(totals.cmvPercentage).toBeCloseTo(31.4879, 3);
    // markup = 28.90 / 9.10 ≈ 3.1758x
    expect(totals.markup).toBeCloseTo(3.1758, 3);
    // margem% = (28.90 - 9.10) / 28.90 * 100 ≈ 68.5121%
    expect(totals.marginPercentage).toBeCloseTo(68.5121, 3);
    // lucro estimado = 28.90 - 9.10 = R$ 19,80
    expect(totals.estimatedProfit).toBeCloseTo(19.8, 4);
  });

  it('retorna indicadores dependentes de preço como null quando o produto não tem salePrice (rascunho)', () => {
    const totals = calculateTotals([4.8, 1.5], null);

    expect(totals.ingredientsCost).toBeCloseTo(6.3, 4);
    expect(totals.totalCost).toBeCloseTo(6.3, 4);
    expect(totals.cmvPercentage).toBeNull();
    expect(totals.markup).toBeNull();
    expect(totals.marginPercentage).toBeNull();
    expect(totals.estimatedProfit).toBeNull();
  });

  it('retorna indicadores null quando totalCost é zero (evita divisão por zero implícita)', () => {
    const totals = calculateTotals([], 28.9);
    expect(totals.totalCost).toBe(0);
    expect(totals.markup).toBeNull();
  });
});
