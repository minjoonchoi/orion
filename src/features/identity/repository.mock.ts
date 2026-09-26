import * as data from "./fixtures";
import type {
  OrganizationDetail,
  OrganizationRow,
  UserDetail,
  UserRow,
} from "./types";
/** Read-only adapter boundary. Replace with validated backend responses once the API contract is defined. */
export const identityRepository = {
  async listUsers(): Promise<UserRow[]> {
    return data.users.map((user) => ({
      ...user,
      roleCount: (data.userRoles[user.id] ?? []).length,
      organizations: data.memberships
        .filter((m) => m.userId === user.id)
        .map((m) => {
          const org = data.organizations.find(
            (o) => o.id === m.organizationId,
          )!;
          return { id: org.id, name: org.name };
        }),
    }));
  },
  async listOrganizations(): Promise<OrganizationRow[]> {
    return data.organizations.map((org) => ({
      ...org,
      leader:
        data.users
          .filter((u) => u.id === data.organizationLeaders[org.id])
          .map(({ id, name }) => ({ id, name }))[0] ?? null,
      parentOrganization:
        data.organizations
          .filter((o) => o.id === data.organizationParents[org.id])
          .map(({ id, name }) => ({ id, name }))[0] ?? null,
      memberCount: data.memberships.filter((m) => m.organizationId === org.id)
        .length,
      serviceAccountCount: data.serviceAccounts.filter(
        (a) => a.organizationId === org.id,
      ).length,
      serviceCount: (data.organizationServices[org.id] ?? []).length,
      roleCount: (data.organizationRoles[org.id] ?? []).length,
    }));
  },
  async getUser(id: string): Promise<UserDetail | null> {
    const user = data.users.find((u) => u.id === id);
    if (!user) return null;
    return {
      user,
      roles: data.roles.filter((r) =>
        (data.userRoles[id] ?? []).includes(r.id),
      ),
      organizations: data.memberships
        .filter((m) => m.userId === id)
        .map((m) => ({
          ...data.organizations.find((o) => o.id === m.organizationId)!,
          joinedAt: m.joinedAt,
        })),
    };
  },
  async getOrganization(id: string): Promise<OrganizationDetail | null> {
    const organization = (await this.listOrganizations()).find(
      (o) => o.id === id,
    );
    if (!organization) return null;
    return {
      organization,
      members: data.memberships
        .filter((m) => m.organizationId === id)
        .map((m) => ({
          ...data.users.find((u) => u.id === m.userId)!,
          joinedAt: m.joinedAt,
        })),
      serviceAccounts: data.serviceAccounts.filter(
        (a) => a.organizationId === id,
      ),
      services: data.services.filter((s) =>
        (data.organizationServices[id] ?? []).includes(s.id),
      ),
      roles: data.roles.filter((r) =>
        (data.organizationRoles[id] ?? []).includes(r.id),
      ),
    };
  },
};
