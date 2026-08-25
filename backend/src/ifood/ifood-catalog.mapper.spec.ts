import { mapProductToIfoodCatalogItem } from './ifood-catalog.mapper';

describe('mapProductToIfoodCatalogItem', () => {
  it('mapeia produto ativo com preço corretamente', () => {
    const result = mapProductToIfoodCatalogItem({
      id: 'prod-1',
      name: 'Smash Burger',
      description: 'Delicioso',
      salePrice: 28.9,
      status: 'ACTIVE',
    });

    expect(result).toEqual({
      externalCode: 'prod-1',
      name: 'Smash Burger',
      description: 'Delicioso',
      price: { value: 28.9 },
      status: 'AVAILABLE',
    });
  });

  it('produto DRAFT ou INACTIVE vira status UNAVAILABLE', () => {
    const draft = mapProductToIfoodCatalogItem({
      id: 'prod-1',
      name: 'X',
      description: null,
      salePrice: 10,
      status: 'DRAFT',
    });
    const inactive = mapProductToIfoodCatalogItem({
      id: 'prod-2',
      name: 'Y',
      description: null,
      salePrice: 10,
      status: 'INACTIVE',
    });

    expect(draft.status).toBe('UNAVAILABLE');
    expect(inactive.status).toBe('UNAVAILABLE');
  });

  it('externalCode é sempre o Product.id — é a correspondência usada na Fase 2', () => {
    const result = mapProductToIfoodCatalogItem({
      id: 'uuid-especifico-do-produto',
      name: 'X',
      description: null,
      salePrice: 10,
      status: 'ACTIVE',
    });

    expect(result.externalCode).toBe('uuid-especifico-do-produto');
  });

  it('description ausente vira undefined, não null (contrato de payload mais limpo)', () => {
    const result = mapProductToIfoodCatalogItem({
      id: 'prod-1',
      name: 'X',
      description: null,
      salePrice: 10,
      status: 'ACTIVE',
    });

    expect(result.description).toBeUndefined();
  });

  it('REJEITA produto sem preço de venda definido', () => {
    expect(() =>
      mapProductToIfoodCatalogItem({
        id: 'prod-1',
        name: 'Sem preço',
        description: null,
        salePrice: null,
        status: 'ACTIVE',
      }),
    ).toThrow('não tem preço de venda definido');
  });
});
