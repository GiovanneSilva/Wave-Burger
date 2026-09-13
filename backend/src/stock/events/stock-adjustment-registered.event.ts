export const STOCK_ADJUSTMENT_REGISTERED_EVENT = 'stock.adjustment.registered';

/**
 * Contrato do evento emitido quando um ajuste MANUAL de estoque
 * (RF-017) é registrado — mesmo padrão desacoplado de
 * `sale.registered`/`purchase.confirmed`: StockModule não conhece
 * FinancialModule, quem reage é `StockLossFinancialListener`.
 *
 * Só ajustes de SAÍDA (`direction: 'OUT'`) geram lançamento financeiro
 * de perda — decisão de negócio confirmada com o usuário em 04/09/2026:
 * ao dar baixa manual num ingrediente (perda/desperdício/correção/
 * inventário), o valor daquele estoque não pode simplesmente
 * desaparecer sem refletir em lugar nenhum do Financeiro. Ajustes de
 * ENTRADA (`direction: 'IN'`, ex.: carga inicial de estoque) não geram
 * lançamento — não representam uma compra nem uma perda.
 */
export interface StockAdjustmentRegisteredEvent {
  organizationId: string;
  businessUnitId: string;
  ingredientId: string;
  direction: 'IN' | 'OUT';
  quantityStandardUnit: number;
  reason: string;
  performedByUserId: string;
}
