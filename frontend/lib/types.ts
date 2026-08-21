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
