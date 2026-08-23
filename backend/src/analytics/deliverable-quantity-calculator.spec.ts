import { calculateDeliverableQuantity } from './deliverable-quantity-calculator';

describe('calculateDeliverableQuantity', () => {
  /**
   * EXEMPLO COMPLETO: Smash Burger usa 0,16kg de carne e 1 pão por
   * unidade. Estoque: 3,24kg de carne (sobra do teste manual do
   * usuário), 5 pães.
   *
   * Carne sustenta: floor(3.24 / 0.16) = 20 unidades
   * Pão sustenta:   floor(5 / 1)       = 5 unidades
   * Gargalo: pão, com 5 unidades entregáveis.
   */
  it('EXEMPLO COMPLETO: identifica o ingrediente gargalo corretamente', () => {
    const result = calculateDeliverableQuantity([
      {
        ingredientId: 'ing-carne',
        ingredientName: 'Carne Bovina',
        consumptionPerUnitStandardUnit: 0.16,
        currentStockStandardUnit: 3.24,
      },
      {
        ingredientId: 'ing-pao',
        ingredientName: 'Pão Brioche',
        consumptionPerUnitStandardUnit: 1,
        currentStockStandardUnit: 5,
      },
    ]);

    expect(result.deliverableQuantity).toBe(5);
    expect(result.limitingIngredientId).toBe('ing-pao');
    expect(result.limitingIngredientName).toBe('Pão Brioche');
  });

  it('arredonda para baixo — não entrega unidade fracionada', () => {
    const result = calculateDeliverableQuantity([
      {
        ingredientId: 'ing-1',
        ingredientName: 'X',
        consumptionPerUnitStandardUnit: 0.3,
        currentStockStandardUnit: 1,
      },
    ]);

    // 1 / 0.3 = 3.33... -> arredonda para 3
    expect(result.deliverableQuantity).toBe(3);
  });

  it('retorna 0 quando o estoque de algum ingrediente já está negativo (PD-001)', () => {
    const result = calculateDeliverableQuantity([
      {
        ingredientId: 'ing-1',
        ingredientName: 'X',
        consumptionPerUnitStandardUnit: 0.16,
        currentStockStandardUnit: -0.5,
      },
    ]);

    expect(result.deliverableQuantity).toBe(0);
    expect(result.limitingIngredientId).toBe('ing-1');
  });

  it('retorna 0 e nenhum ingrediente limitante quando a ficha técnica não tem itens', () => {
    const result = calculateDeliverableQuantity([]);

    expect(result.deliverableQuantity).toBe(0);
    expect(result.limitingIngredientId).toBeNull();
    expect(result.limitingIngredientName).toBeNull();
  });

  it('ingrediente com consumo zero por unidade nunca é o gargalo', () => {
    const result = calculateDeliverableQuantity([
      {
        ingredientId: 'ing-zero',
        ingredientName: 'Sem consumo',
        consumptionPerUnitStandardUnit: 0,
        currentStockStandardUnit: 0,
      },
      {
        ingredientId: 'ing-real',
        ingredientName: 'Real',
        consumptionPerUnitStandardUnit: 0.5,
        currentStockStandardUnit: 2,
      },
    ]);

    expect(result.deliverableQuantity).toBe(4);
    expect(result.limitingIngredientId).toBe('ing-real');
  });
});
