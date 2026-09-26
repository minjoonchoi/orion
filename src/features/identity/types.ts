export type Status = "active" | "inactive";
/** name is the user nickname; id is the stable relationship key. */
export type User = {
  id: string;
  name: string;
  email: string;
  status: "employed" | "on_leave";
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
  roleCount: number;
  organizations: Pick<Organization, "id" | "name">[];
};
export type OrganizationRow = Organization & {
  leader: Pick<User, "id" | "name"> | null;
  parentOrganization: Pick<Organization, "id" | "name"> | null;
  memberCount: number;
  serviceAccountCount: number;
  serviceCount: number;
  roleCount: number;
};
export type UserDetail = {
  roles: Role[];
  user: User;
  organizations: (Organization & { joinedAt: string })[];
};
export type OrganizationDetail = {
  organization: OrganizationRow;
  members: (User & { joinedAt: string })[];
  serviceAccounts: ServiceAccount[];
  services: ManagedService[];
  roles: Role[];
};
