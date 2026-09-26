import {
  array,
  enumeration,
  number,
  object,
  string,
} from "../../lib/api/schema.ts";
const ref = object({ kind: enumeration(["user", "organization"]), id: string });
const field = object({
  key: string,
  label: string,
  required: enumeration(["yes", "no"]),
});
const rule = object({
  label: string,
  action: enumeration(["approve", "agree"]),
  kind: enumeration([
    "user",
    "organization",
    "requester-leader",
    "service-team",
  ]),
  id: string,
});
export const templateSchema = object({
  id: string,
  name: string,
  version: number,
  type: enumeration(["issue", "replace", "revoke"]),
  fields: array(field),
  line: array(rule),
});
const inputSchema = object({
  accountId: string,
  serviceId: string,
  endpointIds: array(string),
  secretName: string,
  secretKey: string,
  reason: string,
});
const stageSchema = object({
  label: string,
  action: enumeration(["approve", "agree"]),
  target: ref,
  status: enumeration(["pending", "approved", "rejected"]),
  actorId: string,
  at: string,
});
const viewerSchema = object({
  target: ref,
  source: enumeration(["requester", "line", "manual"]),
  addedBy: string,
  at: string,
});
const docSchema = object({
  id: string,
  keyId: string,
  template: templateSchema,
  input: inputSchema,
  previousEndpointIds: array(string),
  serviceTeamId: string,
  requesterId: string,
  line: array(stageSchema),
  viewers: array(viewerSchema),
  status: enumeration(["pending", "approved", "rejected"]),
  execution: enumeration(["waiting", "ready", "completed"]),
  createdAt: string,
  executedAt: string,
  executorId: string,
});
const keySchema = object({
  id: string,
  accountId: string,
  serviceId: string,
  endpointIds: array(string),
  secretName: string,
  secretKey: string,
  status: enumeration(["active", "revoked"]),
  hash: string,
  version: number,
  policyId: string,
  roleId: string,
  history: array(
    object({
      approvalId: string,
      version: number,
      hash: string,
      at: string,
      type: enumeration(["issue", "replace", "revoke"]),
    }),
  ),
});
const named = object({ id: string, name: string });
export const stateSchema = object({
  revision: number,
  actorId: string,
  templateAdminIds: array(string),
  users: array(named),
  organizations: array(named),
  memberships: array(object({ userId: string, organizationId: string })),
  leaders: array(object({ userId: string, leaderId: string })),
  accounts: array(named),
  services: array(object({ id: string, name: string, teamId: string })),
  endpoints: array(
    object({
      id: string,
      name: string,
      serviceId: string,
      method: string,
      path: string,
    }),
  ),
  templates: array(templateSchema),
  documents: array(docSchema),
  keys: array(keySchema),
  policies: array(object({ id: string, endpointIds: array(string) })),
  roles: array(
    object({
      id: string,
      policyId: string,
      accountId: string,
      platformId: string,
    }),
  ),
});
export type State = ReturnType<typeof stateSchema.parse>;
export type Template = State["templates"][number];
export type Document = State["documents"][number];
export type KeyRecord = State["keys"][number];
export type Input = Document["input"];
export type Target = Document["viewers"][number]["target"];
export type Command =
  | {
      kind: "request";
      templateId: string;
      keyId: string;
      input: Input;
      requestId: string;
    }
  | { kind: "decide"; id: string; decision: "approved" | "rejected" }
  | { kind: "viewer"; id: string; target: Target }
  | { kind: "execute"; id: string; secretText: string }
  | { kind: "template"; template: Template };
function requireThat(ok: unknown, code: string): asserts ok {
  if (!ok) throw Error(code);
}
export function matches(s: State, t: Target, userId = s.actorId) {
  return t.kind === "user"
    ? t.id === userId
    : s.memberships.some(
        (m) => m.userId === userId && m.organizationId === t.id,
      );
}
export function canRead(s: State, d: Document) {
  return d.viewers.some((v) => matches(s, v.target));
}
export function canAddViewer(s: State, d: Document) {
  return d.line.some((l) => matches(s, l.target));
}
export function canExecute(s: State, d: Document) {
  return (
    d.status === "approved" &&
    d.execution === "ready" &&
    matches(s, {
      kind: "organization",
      id: d.serviceTeamId,
    })
  );
}
export function publicState(s: State): State {
  return { ...s, documents: s.documents.filter((d) => canRead(s, d)) };
}
function validTarget(s: State, t: Target) {
  return (t.kind === "user" ? s.users : s.organizations).some(
    (v) => v.id === t.id,
  );
}
export function apply(
  s: State,
  c: Command,
  expectedRevision: number,
  now: string,
  generatedHash = "",
): State {
  requireThat(s.revision === expectedRevision, "REVISION_CONFLICT");
  const n = structuredClone(s);
  requireThat(
    n.users.some((u) => u.id === n.actorId),
    "FORBIDDEN",
  );
  if (c.kind === "template") {
    requireThat(n.templateAdminIds.includes(n.actorId), "FORBIDDEN");
    const t = templateSchema.parse(c.template),
      old = n.templates.find((x) => x.id === t.id);
    requireThat(
      old ? old.version === t.version : t.version === 0,
      "REVISION_CONFLICT",
    );
    requireThat(
      t.name.trim() &&
        t.name.length <= 120 &&
        t.line.length > 0 &&
        t.line.length <= 10 &&
        t.line.every((l) => l.label.trim()) &&
        t.fields.every((f) => f.label.trim()),
      "INVALID_TEMPLATE",
    );
    requireThat(
      new Set(t.fields.map((f) => f.key)).size === t.fields.length,
      "INVALID_TEMPLATE",
    );
    const required = [
      "accountId",
      "serviceId",
      "endpointIds",
      "secretName",
      "secretKey",
      "reason",
    ];
    requireThat(
      required.every((k) =>
        t.fields.some((f) => f.key === k && f.required === "yes"),
      ),
      "INVALID_TEMPLATE",
    );
    requireThat(
      t.line.every(
        (r) =>
          r.kind === "service-team" ||
          r.kind === "requester-leader" ||
          validTarget(n, { kind: r.kind, id: r.id }),
      ),
      "INVALID_TARGET",
    );
    requireThat(
      t.line.some((r) => r.kind === "service-team"),
      "INVALID_TEMPLATE",
    );
    requireThat(!old || t.type === old.type, "INVALID_TEMPLATE");
    const saved = { ...t, version: (old?.version ?? 0) + 1 };
    if (old) n.templates[n.templates.indexOf(old)] = saved;
    else n.templates.push(saved);
  } else if (c.kind === "request") {
    requireThat(/^[a-zA-Z0-9_-]{8,100}$/.test(c.requestId), "INVALID_INPUT");
    const prior = n.documents.find((d) => d.id === c.requestId);
    if (prior) {
      requireThat(
        prior.requesterId === n.actorId &&
          JSON.stringify(prior.input) === JSON.stringify(c.input) &&
          prior.template.id === c.templateId,
        "CONFLICT",
      );
      return s;
    }
    const t = n.templates.find((t) => t.id === c.templateId);
    requireThat(t, "NOT_FOUND");
    const i = inputSchema.parse(c.input),
      k = n.keys.find((k) => k.id === c.keyId);
    requireThat(
      n.accounts.some((a) => a.id === i.accountId) &&
        n.services.some((v) => v.id === i.serviceId),
      "INVALID_INPUT",
    );
    requireThat(
      i.reason.trim().length > 0 && i.reason.length <= 2000,
      "INVALID_INPUT",
    );
    requireThat(
      i.endpointIds.length > 0 &&
        new Set(i.endpointIds).size === i.endpointIds.length &&
        i.endpointIds.every((id) =>
          n.endpoints.some((e) => e.id === id && e.serviceId === i.serviceId),
        ),
      "INVALID_ENDPOINT",
    );
    requireThat(
      /^[A-Za-z0-9/_+=.@-]{1,512}$/.test(i.secretName) &&
        i.secretKey.trim().length > 0 &&
        i.secretKey.length <= 128 &&
        !["__proto__", "constructor", "prototype"].includes(i.secretKey),
      "INVALID_SECRET",
    );
    requireThat(
      !n.keys.some(
        (x) =>
          x.id !== c.keyId &&
          x.secretName === i.secretName &&
          x.secretKey === i.secretKey,
      ),
      "SECRET_IN_USE",
    );
    requireThat(
      !n.documents.some(
        (x) =>
          x.keyId !== c.keyId &&
          x.status !== "rejected" &&
          x.execution !== "completed" &&
          x.input.secretName === i.secretName &&
          x.input.secretKey === i.secretKey,
      ),
      "SECRET_IN_USE",
    );
    const keyId = t.type === "issue" ? `key-${c.requestId}` : c.keyId;
    if (t.type === "issue")
      requireThat(
        !n.keys.some(
          (k) => k.accountId === i.accountId && k.serviceId === i.serviceId,
        ),
        "PAIR_EXISTS",
      );
    else {
      requireThat(
        k &&
          k.status === "active" &&
          k.accountId === i.accountId &&
          k.serviceId === i.serviceId &&
          k.secretName === i.secretName &&
          k.secretKey === i.secretKey,
        "INVALID_KEY",
      );
      if (t.type === "revoke")
        requireThat(
          JSON.stringify(k.endpointIds) === JSON.stringify(i.endpointIds),
          "INVALID_ENDPOINT",
        );
    }
    requireThat(
      !n.documents.some(
        (d) =>
          d.input.accountId === i.accountId &&
          d.input.serviceId === i.serviceId &&
          d.status !== "rejected" &&
          d.execution !== "completed",
      ),
      "REQUEST_PENDING",
    );
    const line = t.line.map((r) => {
      const target: Target =
        r.kind === "requester-leader"
          ? {
              kind: "user",
              id: n.leaders.find((l) => l.userId === n.actorId)?.leaderId ?? "",
            }
          : r.kind === "service-team"
            ? {
                kind: "organization",
                id: n.services.find((v) => v.id === i.serviceId)!.teamId,
              }
            : { kind: r.kind, id: r.id };
      requireThat(validTarget(n, target), "UNRESOLVED_LINE");
      return {
        label: r.label,
        action: r.action,
        target,
        status: "pending" as const,
        actorId: "",
        at: "",
      };
    });
    const viewers: Document["viewers"] = [
      {
        target: { kind: "user", id: n.actorId },
        source: "requester",
        addedBy: n.actorId,
        at: now,
      },
    ];
    for (const l of line)
      if (
        !viewers.some(
          (v) => v.target.kind === l.target.kind && v.target.id === l.target.id,
        )
      )
        viewers.push({
          target: l.target,
          source: "line",
          addedBy: n.actorId,
          at: now,
        });
    n.documents.push({
      id: c.requestId,
      keyId,
      template: structuredClone(t),
      input: i,
      previousEndpointIds: k ? [...k.endpointIds] : [],
      serviceTeamId: n.services.find((v) => v.id === i.serviceId)!.teamId,
      requesterId: n.actorId,
      line,
      viewers,
      status: "pending",
      execution: "waiting",
      createdAt: now,
      executedAt: "",
      executorId: "",
    });
  } else {
    const d = n.documents.find((d) => d.id === c.id);
    requireThat(d && canRead(n, d), "FORBIDDEN");
    if (c.kind === "viewer") {
      requireThat(canAddViewer(n, d) && validTarget(n, c.target), "FORBIDDEN");
      if (
        !d.viewers.some(
          (v) => v.target.kind === c.target.kind && v.target.id === c.target.id,
        )
      )
        d.viewers.push({
          target: c.target,
          source: "manual",
          addedBy: n.actorId,
          at: now,
        });
    } else if (c.kind === "decide") {
      requireThat(
        d.status === "pending" && ["approved", "rejected"].includes(c.decision),
        "INVALID_STATE",
      );
      const stage = d.line.find((l) => l.status === "pending");
      requireThat(stage && matches(n, stage.target), "FORBIDDEN");
      stage.status = c.decision;
      stage.actorId = n.actorId;
      stage.at = now;
      if (c.decision === "rejected") d.status = "rejected";
      else if (d.line.every((l) => l.status === "approved")) {
        d.status = "approved";
        d.execution = "ready";
      }
    } else if (c.kind === "execute") {
      requireThat(canExecute(n, d), "FORBIDDEN");
      let k = n.keys.find((k) => k.id === d.keyId);
      if (d.template.type === "revoke") {
        requireThat(k && k.status === "active", "INVALID_STATE");
        k.status = "revoked";
        n.roles = n.roles.filter((r) => r.id !== k!.roleId);
        n.policies = n.policies.filter((p) => p.id !== k!.policyId);
      } else {
        requireThat(
          c.secretText.length >= 8 &&
            c.secretText.length <= 8192 &&
            generatedHash,
          "INVALID_SECRET",
        );
        if (d.template.type === "issue") {
          requireThat(
            !k &&
              !n.keys.some(
                (k) =>
                  k.accountId === d.input.accountId &&
                  k.serviceId === d.input.serviceId,
              ),
            "PAIR_EXISTS",
          );
          k = {
            id: d.keyId,
            accountId: d.input.accountId,
            serviceId: d.input.serviceId,
            endpointIds: [],
            secretName: d.input.secretName,
            secretKey: d.input.secretKey,
            status: "active",
            hash: "",
            version: 0,
            policyId: `policy-${d.keyId}`,
            roleId: `role-${d.keyId}`,
            history: [],
          };
          n.keys.push(k);
          n.roles.push({
            id: k.roleId,
            policyId: k.policyId,
            accountId: k.accountId,
            platformId: "orion",
          });
          n.policies.push({ id: k.policyId, endpointIds: [] });
        }
        requireThat(k && k.status === "active", "INVALID_STATE");
        k.endpointIds = [...d.input.endpointIds];
        k.hash = generatedHash;
        k.version++;
        const p = n.policies.find((p) => p.id === k!.policyId);
        requireThat(p, "INVALID_STATE");
        p.endpointIds = [...k.endpointIds];
      }
      k.history.push({
        approvalId: d.id,
        version: k.version,
        hash: k.hash,
        at: now,
        type: d.template.type,
      });
      d.execution = "completed";
      d.executedAt = now;
      d.executorId = n.actorId;
    }
  }
  n.revision++;
  return n;
}
