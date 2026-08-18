import { convertQuantity } from '../common/unit-conversion';

export interface FichaTecnicaItemInput {
  quantity: number;
  unit: string;
  ingredientStandardUnit: string;
  lossPercentage: number;
  costPerStandardUnit: number;
}

export interface FichaTecnicaItemCalculation {
  effectiveQuantityInStandardUnit: number;
  lineCost: number;
}

export interface FichaTecnicaTotals {
  ingredientsCost: number;
  totalCost: number;
  cmvPercentage: number | null;
  markup: number | null;
  marginPercentage: number | null;
  estimatedProfit: number | null;
}

/**
 * RF-005: calcula o custo de um item da ficha técnica.
 *
 * Exemplo do próprio Documento Mestre: 5 kg de carne = R$ 150 → R$ 30/kg;
 * 160 g usados → R$ 4,80. Isso exige converter g→kg (função pura,
 * ver unit-conversion.ts) antes de multiplicar pelo custo por unidade
 * padrão. `lossPercentage` (perda estimada, RF-004) infla a quantidade
 * efetivamente contabilizada.
 */
export function calculateItemCost(input: FichaTecnicaItemInput): FichaTecnicaItemCalculation {
  const quantityInStandardUnit = convertQuantity(
    input.quantity,
    input.unit,
    input.ingredientStandardUnit,
  );
  const effectiveQuantityInStandardUnit = quantityInStandardUnit * (1 + input.lossPercentage / 100);
  const lineCost = round4(effectiveQuantityInStandardUnit * input.costPerStandardUnit);

  return { effectiveQuantityInStandardUnit, lineCost };
}

/**
 * RF-006: indicadores do produto a partir do custo total da ficha e do
 * preço de venda.
 *
 * totalCost = ingredientsCost (custos indiretos — PD-003 — não incluídos).
 * cmvPercentage = totalCost / salePrice × 100 (CMV como % da receita,
 * convenção usual de gestão de restaurantes).
 * markup = salePrice / totalCost (multiplicador).
 * marginPercentage = (salePrice - totalCost) / salePrice × 100.
 * estimatedProfit = salePrice - totalCost.
 *
 * Se o produto não tiver salePrice definido (rascunho), os indicadores
 * dependentes de preço retornam null — só ingredientsCost/totalCost são
 * sempre calculáveis.
 */
export function calculateTotals(lineCosts: number[], salePrice: number | null): FichaTecnicaTotals {
  const ingredientsCost = round4(lineCosts.reduce((sum, cost) => sum + cost, 0));
  const totalCost = ingredientsCost;

  if (salePrice === null || salePrice <= 0 || totalCost === 0) {
    return {
      ingredientsCost,
      totalCost,
      cmvPercentage: null,
      markup: null,
      marginPercentage: null,
      estimatedProfit: null,
    };
  }

  return {
    ingredientsCost,
    totalCost,
    cmvPercentage: round4((totalCost / salePrice) * 100),
    markup: round4(salePrice / totalCost),
    marginPercentage: round4(((salePrice - totalCost) / salePrice) * 100),
    estimatedProfit: round4(salePrice - totalCost),
  };
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
