export const SALE_REGISTERED_EVENT = 'sale.registered';

/**
 * Contrato do evento emitido quando uma venda é registrada.
 *
 * O consumo de estoque (RF-016/BR-009) é SÍNCRONO e transacional dentro
 * de SalesService.registerSale (UC-004 descreve a baixa de estoque como
 * parte íntegra do mesmo caso de uso, não um efeito futuro a preparar).
 * Este evento cobre apenas o efeito financeiro (receita) — mesmo padrão
 * desacoplado de `purchase.confirmed` (Etapa 12), consumido por
 * SalesFinancialListener.
 */
export interface SaleRegisteredEvent {
  saleId: string;
  organizationId: string;
  businessUnitId: string;
  productId: string;
  netAmount: string;
  soldByUserId: string;
  saleDate: Date;
}
