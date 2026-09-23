export type KeyStatus = "active" | "expired" | "revoked";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type RequestType = "issue" | "renew" | "revoke";
// Only public metadata belongs in these read models. Never include a credential.
export type ApiKey = {
  id: string;
  name: string;
  description: string;
  displayHint: string;
  status: KeyStatus;
  organizationId: string;
  ownerId: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
};
export type Approval = {
  id: string;
  keyId: string;
  type: RequestType;
  status: ApprovalStatus;
  requesterId: string;
  reviewerId: string | null;
  requestedAt: string;
  decidedAt: string | null;
  reason: string;
  comment: string | null;
};
export type Person = { id: string; name: string };
export type KeyRow = ApiKey & {
  organization: Person;
  owner: Person;
  approvalCount: number;
};
export type ApprovalRow = Approval & {
  requester: Person;
  reviewer: Person | null;
};
export type KeyDetail = { key: KeyRow; approvals: ApprovalRow[] };
