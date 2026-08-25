export interface IfoodCatalogItemPayload {
  externalCode: string;
  name: string;
  description?: string;
  price: { value: number };
  status: 'AVAILABLE' | 'UNAVAILABLE';
}

export interface ProductForCatalogSync {
  id: string;
  name: string;
  description: string | null;
  salePrice: number | null;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
}

/// Mapeia um Product do Wave Burger para o payload de item do Catalog
/// do iFood (Fase 1 do plano de integração). `externalCode = Product.id`
/// é a correspondência que, na Fase 2, permite identificar de volta qual
/// Product corresponde a um item de um pedido recebido do iFood — sem
/// isso, não daria para saber "isso que chegou é qual produto nosso".
export function mapProductToIfoodCatalogItem(
  product: ProductForCatalogSync,
): IfoodCatalogItemPayload {
  if (product.salePrice === null) {
    throw new Error(
      `Produto "${product.name}" não tem preço de venda definido — não é possível sincronizar com o iFood.`,
    );
  }

  return {
    externalCode: product.id,
    name: product.name,
    description: product.description ?? undefined,
    price: { value: product.salePrice },
    status: product.status === 'ACTIVE' ? 'AVAILABLE' : 'UNAVAILABLE',
  };
}
