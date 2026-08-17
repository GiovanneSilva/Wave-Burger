export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  businessUnitId: string | null;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}
