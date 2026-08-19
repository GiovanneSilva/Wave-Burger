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
