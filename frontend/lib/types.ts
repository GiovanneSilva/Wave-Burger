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
