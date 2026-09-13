export interface WeightedAverageCostInput {
  previousQuantity: number;
  previousAverageCost: number | null;
  purchaseQuantity: number;
  purchaseTotalValue: number;
}

/// PD-002 resolvido em 05/09/2026, a pedido do usuário — custo médio
/// ponderado móvel, o método reconhecido pela Receita Federal para
/// cálculo de CMV. Recalcula a cada compra confirmada, considerando
/// quanto já havia em estoque (e a que custo) ANTES desta compra:
///
///   novo custo médio = (valor do estoque anterior + valor desta compra)
///                       ÷ (quantidade anterior + quantidade comprada)
///
/// `previousAverageCost` nulo (ingrediente nunca teve custo definido —
/// ex.: primeira compra de todas) é tratado como 0: o estoque anterior
/// não tinha valor nenhum atribuído.
///
/// `previousQuantity` precisa ser capturada ANTES de qualquer efeito
/// desta compra ser aplicado ao estoque — ver
/// `PurchasesService.confirm()`, que lê o saldo antes de emitir
/// `purchase.confirmed`, evitando depender da ordem de execução entre
/// `StockPurchaseListener` e `IngredientsPurchaseListener` (o
/// `eventEmitter.emit()` do projeto não garante ordem/conclusão entre
/// listeners do mesmo evento).
export function calculateWeightedAverageCost(input: WeightedAverageCostInput): number {
  const previousValue = input.previousQuantity * (input.previousAverageCost ?? 0);
  const newTotalQuantity = input.previousQuantity + input.purchaseQuantity;

  if (newTotalQuantity <= 0) {
    // Defesa: não deveria ocorrer no fluxo real (toda compra soma
    // quantidade positiva), mas evita divisão por zero/negativo.
    return input.purchaseQuantity > 0 ? input.purchaseTotalValue / input.purchaseQuantity : 0;
  }

  return (previousValue + input.purchaseTotalValue) / newTotalQuantity;
}
