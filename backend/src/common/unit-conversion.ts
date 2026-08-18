import { UnprocessableEntityException } from '@nestjs/common';

/**
 * Conversão de unidades PURAMENTE MÉTRICA (matemática, sem julgamento de
 * negócio): kg↔g, l↔ml. Conversões entre famílias diferentes (ex.: kg→un,
 * "caixa" → unidade) permanecem bloqueadas — isso é o território de
 * PD-011 (conversão de unidades de compra/ficha técnica), que segue sem
 * definição no Documento Mestre.
 */
const UNIT_FAMILY: Record<string, { family: string; toBaseFactor: number }> = {
  kg: { family: 'mass', toBaseFactor: 1 },
  g: { family: 'mass', toBaseFactor: 0.001 },
  l: { family: 'volume', toBaseFactor: 1 },
  ml: { family: 'volume', toBaseFactor: 0.001 },
  un: { family: 'count', toBaseFactor: 1 },
};

export function convertQuantity(quantity: number, fromUnit: string, toUnit: string): number {
  const from = UNIT_FAMILY[fromUnit];
  const to = UNIT_FAMILY[toUnit];

  if (!from || !to) {
    throw new UnprocessableEntityException(`Unidade desconhecida: "${fromUnit}" ou "${toUnit}".`);
  }

  if (from.family !== to.family) {
    throw new UnprocessableEntityException(
      `Não é possível converter "${fromUnit}" para "${toUnit}": unidades de famílias diferentes. ` +
        'Conversões não-métricas (ex.: unidade de compra vs. unidade de uso) dependem de PD-011, ainda em aberto.',
    );
  }

  return (quantity * from.toBaseFactor) / to.toBaseFactor;
}

/**
 * Converte um PREÇO por unidade (ex.: R$/g) para o preço equivalente em
 * outra unidade da mesma família (ex.: R$/kg). Usado para levar o preço
 * declarado numa compra para a unidade padrão do ingrediente (RF-009
 * "último custo"). Mesma restrição de família de convertQuantity.
 */
export function convertPricePerUnit(price: number, fromUnit: string, toUnit: string): number {
  const conversionFactor = convertQuantity(1, fromUnit, toUnit);
  return price / conversionFactor;
}
