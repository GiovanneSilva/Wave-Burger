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
 * `items[].stockQuantityBeforePurchase` (05/09/2026, PD-002): saldo de
 * estoque do ingrediente, em unidade padrão, capturado por
 * `PurchasesService.confirm()` ANTES de qualquer listener rodar —
 * necessário para `IngredientsPurchaseListener` calcular o custo médio
 * ponderado móvel sem depender da ordem de execução entre listeners
 * (`eventEmitter.emit()` não garante ordem/conclusão entre eles).
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
    stockQuantityBeforePurchase: string;
  }>;
}
