export const PURCHASE_CONFIRMED_EVENT = 'purchase.confirmed';

/**
 * Contrato do evento emitido quando uma compra é confirmada.
 *
 * Este é o mecanismo central de desacoplamento entre Compras e os
 * módulos que ainda vão existir (Estoque — Etapa 13; Financeiro —
 * Etapa 15). Nenhum deles é conhecido por PurchasesService; qualquer
 * módulo futuro só precisa se inscrever com @OnEvent(PURCHASE_CONFIRMED_EVENT)
 * — nenhuma mudança em Purchases é necessária (claude/CLAUDE.md, Seção 4:
 * "efeitos entre módulos devem ser implementados via serviços de aplicação
 * ou eventos internos, nunca duplicando lógica em cada módulo").
 *
 * BR-006 (compra confirmada gera entrada de estoque) e BR-007 (compra
 * gera lançamento financeiro) permanecem NÃO implementados — só o
 * contrato do evento existe agora. O único listener ativo hoje é
 * IngredientsPurchaseListener (atualiza lastCost/lastPurchaseDate).
 */
export interface PurchaseConfirmedEvent {
  purchaseId: string;
  organizationId: string;
  businessUnitId: string;
  supplierId: string;
  confirmedByUserId: string;
  confirmedAt: Date;
  totalAmount: string;
  items: Array<{
    ingredientId: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    totalPrice: string;
  }>;
}
