import { object, string, array } from "../../lib/api/schema.ts";
import type { Directory } from "../platforms/model.ts";
import type { State, Document, Command, Template } from "./model.ts";
export const accessSchema = object({
  platformId: string,
  platformName: string,
  roleId: string,
  roleName: string,
  policyIds: array(string),
  reason: string,
  expiresAt: string,
});
export const accessTemplate: Template = {
  id: "access-request",
  name: "권한 신청",
  type: "access",
  version: 1,
  fields: [
    ["platformId", "플랫폼"],
    ["roleId", "신청 역할"],
    ["reason", "신청 사유"],
    ["expiresAt", "사용 종료일"],
  ].map(([key, label]) => ({
    key,
    label,
    required: key === "expiresAt" ? "no" : "yes",
  })),
  line: [
    {
      label: "요청자 팀장 승인",
      action: "approve",
      kind: "requester-leader",
      id: "",
    },
    {
      label: "접근 관리 담당 조직 합의",
      action: "agree",
      kind: "organization",
      id: "org-security",
    },
  ],
};
function check(ok: unknown, code: string): asserts ok {
  if (!ok) throw Error(code);
}
export function activeAccess(s: State, now = new Date().toISOString()) {
  return s.documents.filter(
    (d) =>
      d.access &&
      d.status === "approved" &&
      d.execution === "completed" &&
      (!d.access.expiresAt ||
        Date.parse(d.access.expiresAt + "T23:59:59+09:00") >= Date.parse(now)),
  );
}
function target(
  s: State,
  directory: Directory | undefined,
  userId: string,
  platformId: string,
  roleId: string,
  expiresAt: string,
  now: string,
) {
  check(directory, "ACCESS_UNAVAILABLE");
  const role = directory.roles.find(
    (r) => r.id === roleId && r.platformId === platformId,
  );
  const platform = directory.platforms.find(
    (p) => p.id === platformId && p.status === "active",
  );
  check(role && platform, "INVALID_TARGET");
  check(
    directory.members.some(
      (m) =>
        m.userId === userId &&
        m.platformId === platformId &&
        m.status === "active",
    ),
    "MEMBERSHIP_REQUIRED",
  );
  check(
    !expiresAt ||
      (/^\d{4}-\d{2}-\d{2}$/.test(expiresAt) &&
        Number.isFinite(Date.parse(expiresAt)) &&
        new Date(expiresAt).toISOString().slice(0, 10) === expiresAt &&
        Date.parse(expiresAt + "T23:59:59+09:00") >= Date.parse(now)),
    "INVALID_EXPIRY",
  );
  const orgs = s.memberships
    .filter((m) => m.userId === userId)
    .map((m) => m.organizationId);
  check(
    !directory.userRoles.some(
      (r) =>
        r.userId === userId &&
        r.platformId === platformId &&
        r.roleIds.includes(roleId),
    ) &&
      !directory.organizations.some(
        (o) =>
          o.platformId === platformId &&
          orgs.includes(o.id) &&
          o.roleIds.includes(roleId),
      ) &&
      !activeAccess(s, now).some(
        (d) =>
          d.requesterId === userId &&
          d.access!.roleId === roleId &&
          d.access!.platformId === platformId,
      ),
    "ALREADY_GRANTED",
  );
  return { role, platform };
}
export function requestAccess(
  s: State,
  c: Extract<Command, { kind: "access-request" }>,
  now: string,
  directory?: Directory,
) {
  check(/^[a-zA-Z0-9_-]{8,100}$/.test(c.requestId), "INVALID_INPUT");
  const prior = s.documents.find((d) => d.id === c.requestId);
  if (prior) {
    check(
      prior.requesterId === s.actorId &&
        prior.access &&
        ["platformId", "roleId", "reason", "expiresAt"].every(
          (k) =>
            prior.access![k as keyof typeof prior.access] ===
            c[k as "platformId" | "roleId" | "reason" | "expiresAt"],
        ),
      "CONFLICT",
    );
    return;
  }
  check(c.reason.trim().length > 0 && c.reason.length <= 2000, "INVALID_INPUT");
  const { role, platform } = target(
    s,
    directory,
    s.actorId,
    c.platformId,
    c.roleId,
    c.expiresAt,
    now,
  );
  check(
    !s.documents.some(
      (d) =>
        d.requesterId === s.actorId &&
        d.access?.platformId === c.platformId &&
        d.access?.roleId === c.roleId &&
        (d.status === "pending" ||
          (d.status === "approved" && d.execution !== "completed")),
    ),
    "REQUEST_PENDING",
  );
  const template = s.templates.find((t) => t.type === "access");
  check(template, "ACCESS_UNAVAILABLE");
  const line: Document["line"] = template.line.map((r) => {
    const target =
      r.kind === "requester-leader"
        ? {
            kind: "user" as const,
            id: s.leaders.find((l) => l.userId === s.actorId)?.leaderId ?? "",
          }
        : { kind: r.kind as "user" | "organization", id: r.id };
    check(
      (target.kind === "user" ? s.users : s.organizations).some(
        (v) => v.id === target.id,
      ) && !(target.kind === "user" && target.id === s.actorId),
      "UNRESOLVED_LINE",
    );
    return {
      label: r.label,
      action: r.action,
      target,
      status: "pending",
      actorId: "",
      at: "",
    };
  });
  check(
    line.length > 0 && line.at(-1)?.target.kind === "organization",
    "UNRESOLVED_LINE",
  );
  s.documents.push({
    id: c.requestId,
    keyId: "",
    template: structuredClone(template),
    input: {
      accountId: "",
      serviceId: "",
      endpointIds: [],
      secretName: "",
      secretKey: "",
      reason: c.reason,
    },
    access: {
      platformId: platform.id,
      platformName: platform.name,
      roleId: role.id,
      roleName: role.name,
      policyIds: [...role.policyIds].sort(),
      reason: c.reason,
      expiresAt: c.expiresAt,
    },
    previousEndpointIds: [],
    serviceTeamId: line.at(-1)!.target.id,
    requesterId: s.actorId,
    line,
    viewers: [
      {
        target: { kind: "user", id: s.actorId },
        source: "requester",
        addedBy: s.actorId,
        at: now,
      },
      ...line.map((l) => ({
        target: l.target,
        source: "line" as const,
        addedBy: s.actorId,
        at: now,
      })),
    ],
    status: "pending",
    execution: "waiting",
    createdAt: now,
    executedAt: "",
    executorId: "",
  });
}
export function executeAccess(
  s: State,
  d: Document,
  now: string,
  directory?: Directory,
) {
  check(d.access, "INVALID_STATE");
  const a = d.access;
  const { role } = target(
    s,
    directory,
    d.requesterId,
    a.platformId,
    a.roleId,
    a.expiresAt,
    now,
  );
  check(
    JSON.stringify([...role.policyIds].sort()) === JSON.stringify(a.policyIds),
    "ACCESS_CHANGED",
  );
  d.execution = "completed";
  d.executedAt = now;
  d.executorId = s.actorId;
}
