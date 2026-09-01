export interface AuthUser {
  id: string;
  organizationId: string;
  businessUnitId: string | null;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    organizationId: string;
    businessUnitId: string | null;
    roles: string[];
    permissions: string[];
  };
}

export interface MostProfitableProduct {
  productId: string;
  productName: string;
  estimatedProfit: number | null;
  marginPercentage: number | null;
}

export interface ExecutiveDashboard {
  periodo: { from: string; to: string };
  faturamento: number;
  cmv: number;
  margemBruta: number | null;
  lucroOperacional: number;
  produtosMaisLucrativos: MostProfitableProduct[];
  produtosMaisVendidos: null;
  ticketMedio: null;
  pontoDeEquilibrio: null;
  indicadoresNaoDisponiveis: string;
}

export interface Product {
  id: string;
  name: string;
  internalCode: string | null;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  salePrice: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FichaTecnicaItem {
  id: string;
  ingredientId: string;
  quantity: string;
  unit: string;
  lossPercentage: string;
  costSnapshot: string;
  lineCost: string;
  ingredient?: { id: string; name: string; standardUnit: string };
}

export interface FichaTecnicaVersion {
  id: string;
  productId: string;
  version: number;
  isCurrent: boolean;
  ingredientsCost: string;
  totalCost: string;
  cmvPercentage: string | null;
  markup: string | null;
  marginPercentage: string | null;
  estimatedProfit: string | null;
  createdAt: string;
  items: FichaTecnicaItem[];
}

export interface CostTotals {
  ingredientsCost: number;
  totalCost: number;
  cmvPercentage: number | null;
  markup: number | null;
  marginPercentage: number | null;
  estimatedProfit: number | null;
}

export interface CurrentCostSummary {
  productId: string;
  version: number;
  frozenAtVersionCreation: CostTotals;
  currentLive: CostTotals;
  costDrifted: boolean;
}

export interface Ingredient {
  id: string;
  name: string;
  standardUnit: string;
  category: string | null;
  storageLocation: string | null;
  minimumStock: string | null;
  averageCost: string | null;
  lastCost: string | null;
  lastPurchaseDate: string | null;
  isActive: boolean;
}

export interface SimulationItemResult {
  ingredientId: string;
  ingredientName: string;
  quantity: string;
  unit: string;
  costPerStandardUnitUsed: number;
  isSimulatedCost: boolean;
  lineCost: number;
}

export interface SimulationResult {
  productId: string;
  salePriceUsed: number | null;
  items: SimulationItemResult[];
  simulatedTotals: CostTotals;
  comparedToCurrentVersion: { totalCostDelta: number; estimatedProfitDelta: number | null } | null;
}

export interface StockBalance {
  id: string;
  businessUnitId: string;
  ingredientId: string;
  currentQuantity: string;
  updatedAt: string;
  ingredient: {
    id: string;
    name: string;
    standardUnit: string;
    minimumStock: string | null;
  };
}

export interface StockMovement {
  id: string;
  ingredientId: string;
  direction: 'IN' | 'OUT';
  source: 'PURCHASE' | 'MANUAL_ADJUSTMENT' | 'SALE';
  adjustmentReason: 'LOSS' | 'WASTE' | 'INVENTORY' | 'CORRECTION' | 'RETURN' | null;
  quantity: string;
  unit: string;
  notes: string | null;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  taxId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  paymentTerms: string | null;
  averageDeliveryDays: number | null;
  isActive: boolean;
}

export interface SupplierIngredientLink {
  id: string;
  supplierId: string;
  ingredientId: string;
  isPreferred: boolean;
  ingredient: {
    id: string;
    name: string;
    standardUnit: string;
  };
}

export interface PurchaseItem {
  id: string;
  ingredientId: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  totalPrice: string;
}

export interface Purchase {
  id: string;
  supplierId: string;
  businessUnitId: string;
  purchaseDate: string;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  totalAmount: string;
  confirmedAt: string | null;
  createdAt: string;
  items: PurchaseItem[];
}

export interface Sale {
  id: string;
  businessUnitId: string;
  productId: string;
  quantity: string;
  unitPriceSnapshot: string;
  grossAmount: string;
  discountType: 'PERCENTAGE' | 'FIXED' | null;
  discountValue: string | null;
  discountAmount: string;
  netAmount: string;
  saleDate: string;
  hadInsufficientStock: boolean;
  createdAt: string;
  stockWarnings?: Array<{ ingredientId: string; ingredientName: string; resultingBalance: string }>;
}

export interface FinancialEntry {
  id: string;
  businessUnitId: string;
  type: 'PAYABLE' | 'RECEIVABLE';
  category: string;
  description: string;
  supplierId: string | null;
  purchaseId: string | null;
  saleId: string | null;
  grossAmount: string;
  dueDate: string | null;
  settledAt: string | null;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  createdAt: string;
}

export interface CashFlowResult {
  from: string;
  to: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

export interface DreResult {
  from: string;
  to: string;
  receitaBruta: number;
  taxas: number;
  impostos: number;
  cmv: number;
  lucroBruto: number;
  despesasOperacionais: number;
  resultadoOperacional: number;
}

export interface ConsumptionItem {
  ingredientId: string;
  ingredientName: string;
  totalConsumed: number;
}

export interface StockAnalyticsDashboard {
  periodo: { from: string; to: string };
  consumoPeriodo: ConsumptionItem[];
}

export interface SupplierPriceHistoryItem {
  supplierId: string;
  supplierName: string;
  purchaseDate: string;
  unitPrice: string;
  unit: string;
}

export interface SupplierAnalysis {
  ingredientId: string;
  ingredientName: string;
  custoMedio: string | null;
  ultimoCusto: string | null;
  ultimaCompra: SupplierPriceHistoryItem | null;
  historicoPrecos: SupplierPriceHistoryItem[];
  variacaoPreco: { min: number; max: number; average: number } | null;
  fornecedoresVinculados: Array<{
    id: string;
    isPreferred: boolean;
    supplier: { id: string; name: string };
  }>;
}

export interface DeliverableQuantity {
  productId: string;
  productName: string;
  deliverableQuantity: number;
  limitingIngredientId: string | null;
  limitingIngredientName: string | null;
}

export interface CatalogSyncResult {
  productId: string;
  productName: string;
  success: boolean;
  error?: string;
}

export interface CriticalStockItem {
  id: string;
  currentQuantity: string;
  ingredient: {
    id: string;
    name: string;
    minimumStock: string;
    standardUnit: string;
  };
}
