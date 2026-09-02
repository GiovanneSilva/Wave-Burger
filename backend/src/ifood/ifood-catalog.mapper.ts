export interface IfoodItemPayload {
  item: {
    id: string;
    type: 'DEFAULT';
    categoryId: string;
    status: 'AVAILABLE' | 'UNAVAILABLE';
    price: { value: number };
    externalCode: string;
    productId: string;
  };
  products: Array<{ id: string; name: string; description?: string; externalCode: string }>;
  optionGroups: never[];
  options: never[];
}

export interface ProductForCatalogSync {
  id: string;
  name: string;
  description: string | null;
  salePrice: number | null;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
}

/// Monta o payload completo esperado por `PUT /catalog/v2.0/merchants/
/// {merchantId}/items` (Fase 1 do plano de integração).
///
/// Correção de 01/09/2026: a primeira versão desta função enviava os
/// campos do item soltos, sem aninhamento — o iFood recusou com
/// `FullItemDto is not valid / item should not be empty`. O formato
/// real exige o item dentro de um campo `item`, acompanhado de um
/// array `products` (mesmo sem complementos, é preciso declarar o
/// "produto" associado separadamente) e exige `categoryId` de uma
/// categoria já existente no cardápio do iFood — resolvida pelo
/// `IfoodCatalogSyncService` antes de chamar esta função.
///
/// `Product.id` é reaproveitado como `item.id`, `products[0].id` e
/// `externalCode` — mesma correspondência 1:1 da Fase 1 original, só
/// que agora aplicada em três lugares do payload em vez de um.
export function buildIfoodItemPayload(
  product: ProductForCatalogSync,
  categoryId: string,
): IfoodItemPayload {
  if (product.salePrice === null) {
    throw new Error(
      `Produto "${product.name}" não tem preço de venda definido — não é possível sincronizar com o iFood.`,
    );
  }

  return {
    item: {
      id: product.id,
      type: 'DEFAULT',
      categoryId,
      status: product.status === 'ACTIVE' ? 'AVAILABLE' : 'UNAVAILABLE',
      price: { value: product.salePrice },
      externalCode: product.id,
      productId: product.id,
    },
    products: [
      {
        id: product.id,
        name: product.name,
        description: product.description ?? undefined,
        externalCode: product.id,
      },
    ],
    optionGroups: [],
    options: [],
  };
}
