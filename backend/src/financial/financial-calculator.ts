export interface DreInput {
  receivedEntries: number[]; // valores de RECEIVABLE liquidados no período
  payableByCategory: Record<string, number[]>; // valores de PAYABLE liquidados no período, agrupados por categoria
  impostos?: number; // manual — PD-006 (regime tributário) não resolvido, sem cálculo automático
}

export interface DreResult {
  receitaBruta: number;
  taxas: number;
  impostos: number;
  cmv: number;
  lucroBruto: number;
  despesasOperacionais: number;
  resultadoOperacional: number;
}

const sum = (values: number[]) => round4(values.reduce((total, v) => total + v, 0));

/**
 * RF-024: DRE gerencial.
 *
 *   Receita bruta
 *   (-) taxas          [categoria PLATAFORMA — ex.: comissão do iFood]
 *   (-) impostos        [manual — PD-006 em aberto, sem cálculo automático]
 *   (-) CMV             [categoria MATERIA_PRIMA — aproximação por despesa,
 *                         já que não há módulo de Vendas (Etapa 16) para
 *                         calcular CMV real por volume vendido]
 *   = lucro bruto
 *   (-) despesas operacionais [demais categorias]
 *   = resultado operacional
 *
 * BR-016: todo valor é derivado de lançamentos REGISTRADOS e
 * CATEGORIZADOS — nada é estimado.
 */
export function calculateDre(input: DreInput): DreResult {
  const receitaBruta = sum(input.receivedEntries);
  const taxas = sum(input.payableByCategory.PLATAFORMA ?? []);
  const cmv = sum(input.payableByCategory.MATERIA_PRIMA ?? []);
  const impostos = round4(input.impostos ?? 0);

  const lucroBruto = round4(receitaBruta - taxas - impostos - cmv);

  const operationalCategories = Object.keys(input.payableByCategory).filter(
    (category) => category !== 'PLATAFORMA' && category !== 'MATERIA_PRIMA',
  );
  const despesasOperacionais = sum(
    operationalCategories.flatMap((category) => input.payableByCategory[category]),
  );

  const resultadoOperacional = round4(lucroBruto - despesasOperacionais);

  return {
    receitaBruta,
    taxas,
    impostos,
    cmv,
    lucroBruto,
    despesasOperacionais,
    resultadoOperacional,
  };
}

export interface CashFlowResult {
  entradas: number;
  saidas: number;
  saldo: number;
}

/// RF-020: fluxo de caixa — soma de entradas (RECEIVABLE liquidadas) e
/// saídas (PAYABLE liquidadas) num período. A granularidade (dia/semana/
/// mês/personalizado) é escolhida pelo chamador ao definir o intervalo.
export function calculateCashFlow(received: number[], paid: number[]): CashFlowResult {
  const entradas = sum(received);
  const saidas = sum(paid);
  return { entradas, saidas, saldo: round4(entradas - saidas) };
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
