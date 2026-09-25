export type ApprovalStatus = "pending" | "approved" | "rejected";
export type RequestType = "issue" | "renew" | "revoke";
export type Approval = {
  id: string;
  keyId: string;
  templateId: string;
  type: RequestType;
  status: ApprovalStatus;
  requesterId: string;
  reviewerId: string | null;
  requestedAt: string;
  decidedAt: string | null;
  reason: string;
  comment: string | null;
};
export type ApprovalTemplate = {
  id: string;
  name: string;
  description: string;
  type: RequestType;
  version: number;
  status: "active" | "inactive";
  instructions: string;
  createdAt: string;
  updatedAt: string;
};
export type ApprovalRecord = Approval & {
  title: string;
  keyName: string;
  templateName: string;
  templateVersion: number;
  requester: { id: string; name: string };
  reviewer: { id: string; name: string } | null;
};
