import type { Approval } from "../approvals/types";
export type { ApprovalStatus, RequestType } from "../approvals/types";
export type KeyStatus = "active" | "expired" | "revoked";
// Only public metadata belongs in these read models. Never include a credential.
export type ApiKey = {
  id: string;
  name: string;
  description: string;
  displayHint: string;
  status: KeyStatus;
  serviceAccountId: string;
  serviceId: string;
  organizationId: string;
  ownerId: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
};
export type Person = { id: string; name: string };
export type KeyRow = ApiKey & {
  serviceAccount: Person;
  service: Person;
  organization: Person;
  owner: Person;
  approvalCount: number;
};
export type ApprovalRow = Approval & {
  requester: Person;
  reviewer: Person | null;
};
export type KeyDetail = { key: KeyRow; approvals: ApprovalRow[] };
