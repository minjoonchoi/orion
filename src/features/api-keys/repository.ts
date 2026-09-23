import { users, organizations } from "../identity/fixtures";
import { apiKeys, approvals } from "./fixtures";
import type { KeyRow, KeyDetail, Person } from "./types";
const person = (id: string): Person => {
  const user = users.find((u) => u.id === id)!;
  return { id: user.id, name: user.name };
};
const rows = (): KeyRow[] =>
  apiKeys.map((key) => {
    const org = organizations.find((o) => o.id === key.organizationId)!;
    return {
      ...key,
      organization: { id: org.id, name: org.name },
      owner: person(key.ownerId),
      approvalCount: approvals.filter((a) => a.keyId === key.id).length,
    };
  });
// Replace with a metadata-only API adapter after the backend contract is defined.
export const apiKeyRepository = {
  async listKeys() {
    return rows();
  },
  async getKey(id: string): Promise<KeyDetail | null> {
    const key = rows().find((k) => k.id === id);
    return key
      ? {
          key,
          approvals: approvals
            .filter((a) => a.keyId === id)
            .map((a) => ({
              ...a,
              requester: person(a.requesterId),
              reviewer: a.reviewerId ? person(a.reviewerId) : null,
            }))
            .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
        }
      : null;
  },
};
