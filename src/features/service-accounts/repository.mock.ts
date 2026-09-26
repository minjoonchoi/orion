import {
  serviceAccounts,
  organizations,
  roles,
  services,
  organizationServices,
} from "../identity/fixtures";
import type { ServiceAccount, Role } from "../identity/types";
import type { KeyRow } from "../api-keys/types";
import { apiKeyRepository } from "../api-keys/repository";
import { serviceAccountRoles, serviceAccountKeys } from "./fixtures";
export type AccountRow = ServiceAccount & {
  organization: { id: string; name: string };
  roleCount: number;
  keyCount: number;
};
export type AccountDetail = {
  account: AccountRow;
  roles: Role[];
  keys: KeyRow[];
  issuableServices: { id: string; name: string }[];
};
const rows = (): AccountRow[] =>
  serviceAccounts.map((a) => {
    const org = organizations.find((o) => o.id === a.organizationId)!;
    return {
      ...a,
      organization: { id: org.id, name: org.name },
      roleCount: (serviceAccountRoles[a.id] ?? []).length,
      keyCount: (serviceAccountKeys[a.id] ?? []).length,
    };
  });
export const serviceAccountRepository = {
  async listAccounts() {
    return rows();
  },
  async getAccount(id: string): Promise<AccountDetail | null> {
    const account = rows().find((a) => a.id === id);
    if (!account) return null;
    return {
      account,
      issuableServices: services
        .filter(
          (s) =>
            s.status === "active" &&
            (organizationServices[account.organization.id] ?? []).includes(
              s.id,
            ),
        )
        .map(({ id, name }) => ({ id, name })),
      roles: roles.filter((r) =>
        (serviceAccountRoles[id] ?? []).includes(r.id),
      ),
      keys: (await apiKeyRepository.listKeys()).filter((k) =>
        (serviceAccountKeys[id] ?? []).includes(k.id),
      ),
    };
  },
};
