export type Status = "active" | "inactive";
export type User = {
  id: string;
  name: string;
  email: string;
  employeeNumber: string;
  title: string;
  status: Status;
  createdAt: string;
  lastSignedInAt: string | null;
};
export type Organization = {
  id: string;
  name: string;
  code: string;
  description: string;
  status: Status;
  createdAt: string;
};
export type Role = { id: string; name: string; description: string };
export type ManagedService = {
  id: string;
  name: string;
  description: string;
  status: Status;
};
export type ServiceAccount = {
  id: string;
  name: string;
  description: string;
  status: Status;
  createdAt: string;
  lastUsedAt: string | null;
};
export type Membership = {
  userId: string;
  organizationId: string;
  joinedAt: string;
};
export type UserRow = User & {
  organizations: Pick<Organization, "id" | "name">[];
  roleCount: number;
};
export type OrganizationRow = Organization & {
  memberCount: number;
  serviceAccountCount: number;
  serviceCount: number;
  roleCount: number;
};
export type UserDetail = {
  user: User;
  organizations: (Organization & { joinedAt: string })[];
  roles: Role[];
};
export type OrganizationDetail = {
  organization: OrganizationRow;
  members: (User & { joinedAt: string })[];
  serviceAccounts: ServiceAccount[];
  services: ManagedService[];
  roles: Role[];
};
