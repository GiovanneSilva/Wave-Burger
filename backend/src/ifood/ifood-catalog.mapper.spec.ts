import { buildIfoodItemPayload } from './ifood-catalog.mapper';

describe('buildIfoodItemPayload', () => {
  /**
   * EXEMPLO COMPLETO: reproduz o payload real esperado por
   * PUT /catalog/v2.0/merchants/{merchantId}/items, confirmado pela
   * documentação depois do erro 400 "FullItemDto is not valid".
   */
  it('EXEMPLO COMPLETO: monta o payload aninhado corretamente', () => {
    const result = buildIfoodItemPayload(
      {
        id: 'prod-1',
        name: 'Smash Burger',
        description: 'Delicioso',
        salePrice: 28.9,
        status: 'ACTIVE',
      },
      'cat-lanches-001',
    );

    expect(result).toEqual({
      item: {
        id: 'prod-1',
        type: 'DEFAULT',
        categoryId: 'cat-lanches-001',
        status: 'AVAILABLE',
        price: { value: 28.9 },
        externalCode: 'prod-1',
        productId: 'prod-1',
      },
      products: [
        { id: 'prod-1', name: 'Smash Burger', description: 'Delicioso', externalCode: 'prod-1' },
      ],
      optionGroups: [],
      options: [],
    });
  });

  it('produto DRAFT ou INACTIVE vira status UNAVAILABLE', () => {
    const draft = buildIfoodItemPayload(
      { id: 'p1', name: 'X', description: null, salePrice: 10, status: 'DRAFT' },
      'cat-1',
    );
    const inactive = buildIfoodItemPayload(
      { id: 'p2', name: 'Y', description: null, salePrice: 10, status: 'INACTIVE' },
      'cat-1',
    );

    expect(draft.item.status).toBe('UNAVAILABLE');
    expect(inactive.item.status).toBe('UNAVAILABLE');
  });

  it('Product.id é reaproveitado em item.id, products[0].id e externalCode — mesma correspondência 1:1', () => {
    const result = buildIfoodItemPayload(
      { id: 'uuid-especifico', name: 'X', description: null, salePrice: 10, status: 'ACTIVE' },
      'cat-1',
    );

    expect(result.item.id).toBe('uuid-especifico');
    expect(result.item.externalCode).toBe('uuid-especifico');
    expect(result.item.productId).toBe('uuid-especifico');
    expect(result.products[0].id).toBe('uuid-especifico');
    expect(result.products[0].externalCode).toBe('uuid-especifico');
  });

  it('description ausente vira undefined, não null', () => {
    const result = buildIfoodItemPayload(
      { id: 'p1', name: 'X', description: null, salePrice: 10, status: 'ACTIVE' },
      'cat-1',
    );

    expect(result.products[0].description).toBeUndefined();
  });

  it('REJEITA produto sem preço de venda definido', () => {
    expect(() =>
      buildIfoodItemPayload(
        { id: 'p1', name: 'Sem preço', description: null, salePrice: null, status: 'ACTIVE' },
        'cat-1',
      ),
    ).toThrow('não tem preço de venda definido');
  });

  it('optionGroups e options ficam vazios — Wave Burger ainda não modela complementos', () => {
    const result = buildIfoodItemPayload(
      { id: 'p1', name: 'X', description: null, salePrice: 10, status: 'ACTIVE' },
      'cat-1',
    );

    expect(result.optionGroups).toEqual([]);
    expect(result.options).toEqual([]);
  });
});
