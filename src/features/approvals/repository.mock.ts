import { users } from "../identity/fixtures";
import { apiKeys } from "../api-keys/fixtures";
import { approvals, templates } from "./fixtures";
import type { ApprovalRecord } from "./types";
const person = (id: string) => {
  const u = users.find((u) => u.id === id)!;
  return { id: u.id, name: u.name };
};
const rows = (): ApprovalRecord[] =>
  approvals
    .map((a) => {
      const key = apiKeys.find((k) => k.id === a.keyId)!;
      const template = templates.find((t) => t.id === a.templateId)!;
      return {
        ...a,
        title: `${key.name} · ${template.name}`,
        keyName: key.name,
        templateName: template.name,
        templateVersion: template.version,
        requester: person(a.requesterId),
        reviewer: a.reviewerId ? person(a.reviewerId) : null,
      };
    })
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
export const approvalRepository = {
  async listTemplates() {
    return templates;
  },
  async getTemplate(id: string) {
    return templates.find((t) => t.id === id) ?? null;
  },
  async listApprovals() {
    return rows();
  },
  async getApproval(id: string) {
    return rows().find((a) => a.id === id) ?? null;
  },
};
