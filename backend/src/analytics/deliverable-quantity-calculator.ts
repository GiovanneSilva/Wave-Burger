export interface IngredientRequirement {
  ingredientId: string;
  ingredientName: string;
  /// Quanto do ingrediente (na unidade padrão) é consumido por 1 unidade
  /// vendida do produto. Deliberadamente SEM ajuste de `lossPercentage`
  /// — é o mesmo valor que `SalesService.registerSale` de fato desconta
  /// do estoque hoje (Etapa 16), então "quantidade entregável" reflete
  /// quando o estoque realmente vai acabar, não uma estimativa teórica.
  consumptionPerUnitStandardUnit: number;
  currentStockStandardUnit: number;
}

export interface DeliverableQuantityResult {
  deliverableQuantity: number;
  limitingIngredientId: string | null;
  limitingIngredientName: string | null;
}

/// Para cada ingrediente da ficha técnica, calcula quantas unidades do
/// produto o estoque atual sustenta (arredondado para baixo — não dá
/// pra vender meio hambúrguer). O menor valor entre todos os
/// ingredientes é o "gargalo": é ele que decide quanto dá pra entregar.
export function calculateDeliverableQuantity(
  requirements: IngredientRequirement[],
): DeliverableQuantityResult {
  if (requirements.length === 0) {
    return { deliverableQuantity: 0, limitingIngredientId: null, limitingIngredientName: null };
  }

  let limiting: { units: number; ingredientId: string; ingredientName: string } | null = null;

  for (const req of requirements) {
    const units =
      req.consumptionPerUnitStandardUnit > 0
        ? Math.floor(req.currentStockStandardUnit / req.consumptionPerUnitStandardUnit)
        : Number.POSITIVE_INFINITY;

    if (limiting === null || units < limiting.units) {
      limiting = { units, ingredientId: req.ingredientId, ingredientName: req.ingredientName };
    }
  }

  return {
    deliverableQuantity: Math.max(0, limiting!.units),
    limitingIngredientId: limiting!.ingredientId,
    limitingIngredientName: limiting!.ingredientName,
  };
}
