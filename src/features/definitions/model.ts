import { parseAllDocuments } from "yaml";
import type { Graph } from "../authorization/model.ts";
export const kinds = [
  "workspaces",
  "pages",
  "services",
  "service-endpoints",
  "domains",
  "actions",
  "policies",
] as const;
export type Kind = (typeof kinds)[number];
export type Obj = Record<string, unknown>;
export type Entity = {
  key: string;
  kind: Kind;
  id: string;
  parent: string;
  name: string;
  definition: Obj;
  refs: string[];
  absent: boolean;
};
export type History = {
  key: string;
  revision: number;
  at: string;
  actor: string;
  execution: string;
  source: string;
  definition: Entity | null;
};
export type Snapshot = {
  revision: number;
  sourceRevision: string;
  environment: string;
  region: string;
  applied: Entity[];
  desired: Entity[];
  history: History[];
  graph: Graph;
};
export type Plan = {
  keys: string[];
  selected: string[];
  before: Entity[];
  after: Entity[];
  changes: { key: string; before: Entity | null; after: Entity | null }[];
  blockers: string[];
};
export type Preview = {
  token: string;
  expiresAt: string;
  revision: number;
  sourceRevision: string;
  plan: Plan;
};
export const labels: Record<Kind, string> = {
  workspaces: "워크스페이스",
  pages: "페이지",
  services: "서비스",
  "service-endpoints": "엔드포인트",
  domains: "업무 도메인",
  actions: "Action",
  policies: "정책",
};
export function key(kind: Kind, id: string, parent = "") {
  return `${kind}:${parent ? parent + "/" : ""}${id}`;
}
export function href(e: Pick<Entity, "kind" | "id" | "parent">) {
  return `/${e.kind}/${encodeURIComponent(e.parent ? e.parent + "~" + e.id : e.id)}`;
}
export function object(v: unknown): Obj {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error("INVALID_OBJECT");
  return v as Obj;
}
function exact(v: Obj, allowed: string[]) {
  for (const k of Object.keys(v))
    if (!allowed.includes(k)) throw Error(`UNKNOWN_FIELD: ${k}`);
}
export function str(v: unknown): string {
  if (typeof v !== "string" || !v.trim()) throw Error("INVALID_STRING");
  return v;
}
function id(v: unknown) {
  const s = str(v);
  if (!/^[a-z][a-z0-9_-]{0,99}$/.test(s)) throw Error(`INVALID_ID: ${s}`);
  return s;
}
function list(v: unknown): unknown[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw Error("INVALID_LIST");
  return v;
}
function unique(xs: string[]) {
  if (new Set(xs).size !== xs.length) throw Error("DUPLICATE_REFERENCE");
}
function ref(v: unknown, fields: string[]) {
  const r = object(v);
  exact(r, fields);
  for (const f of fields) id(r[f]);
  return r;
}
function wrapped(v: unknown, fields: string[]) {
  const r = object(v);
  exact(r, ["ref"]);
  return ref(r.ref, fields);
}
export function actionKey(r: unknown) {
  const v = ref(r, ["domain", "action"]);
  return key("actions", String(v.action), String(v.domain));
}
export function endpointKey(r: unknown) {
  const v = ref(r, ["service", "endpoint"]);
  return key("service-endpoints", String(v.endpoint), String(v.service));
}
export function pageKey(r: unknown) {
  const v = ref(r, ["workspace", "page"]);
  return key("pages", String(v.page), String(v.workspace));
}
export function grants(e: Entity): Obj[] {
  return list(object(e.definition.resources).actions).map(object);
}
export function fields(e: Entity, phase: "request" | "response"): Obj {
  const phaseObject = e.definition[phase];
  return phaseObject ? object(object(phaseObject).fields) : {};
}
function validateFields(v: unknown, phase: "request" | "response") {
  if (v === undefined) return;
  const r = object(v);
  exact(r, ["fields"]);
  const fs = object(r.fields);
  const paths: string[] = [];
  for (const [name, value] of Object.entries(fs)) {
    id(name);
    const f = object(value);
    exact(
      f,
      phase === "request"
        ? ["path", "type", "required", "location"]
        : ["path", "type"],
    );
    const p = str(f.path);
    if (
      !["string", "number", "integer", "boolean", "object", "array"].includes(
        str(f.type),
      )
    )
      throw Error("INVALID_FIELD_TYPE");
    if (phase === "request") {
      if (!["path", "query", "header", "body"].includes(str(f.location)))
        throw Error("INVALID_FIELD_LOCATION");
      if (f.required !== undefined && typeof f.required !== "boolean")
        throw Error("INVALID_REQUIRED");
    }
    if ((phase === "response" || f.location === "body") && !p.startsWith("/"))
      throw Error("INVALID_FIELD_PATH");
    paths.push(`${f.location ?? phase}:${p}`);
  }
  unique(paths);
}
function validateMask(v: unknown) {
  const m = object(v);
  exact(m, ["method", "count", "replacement"]);
  if (!["email", "keep-last", "redact"].includes(str(m.method)))
    throw Error("INVALID_MASK");
  if (
    m.method === "keep-last" &&
    (!Number.isInteger(m.count) || Number(m.count) < 0 || Number(m.count) > 100)
  )
    throw Error("INVALID_MASK_COUNT");
  if (m.method !== "keep-last" && m.count !== undefined)
    throw Error("INVALID_MASK_COUNT");
  if (
    m.replacement !== undefined &&
    (typeof m.replacement !== "string" || m.replacement.length !== 1)
  )
    throw Error("INVALID_MASK_REPLACEMENT");
}
function validatePolicy(d: Obj) {
  if (!["allow", "deny"].includes(str(d.effect))) throw Error("INVALID_EFFECT");
  const r = object(d.resources);
  exact(r, ["page", "actions"]);
  if (r.page) wrapped(r.page, ["workspace", "page"]);
  const gs = list(r.actions).map(object);
  unique(gs.map((g) => actionKey(g.ref)));
  if (!r.page && !gs.length) throw Error("EMPTY_POLICY");
  for (const g of gs) {
    exact(g, ["ref", "response"]);
    actionKey(g.ref);
    if (d.effect === "deny") {
      if (g.response !== undefined) throw Error("DENY_RESPONSE");
      continue;
    }
    const response = object(g.response);
    exact(response, ["fields", "unmask", "body"]);
    if (
      response.fields === undefined &&
      response.unmask === undefined &&
      response.body !== "none"
    )
      throw Error("EXPLICIT_RESPONSE_REQUIRED");
    if (response.body !== undefined && response.body !== "none")
      throw Error("INVALID_BODY");
    if (
      response.body === "none" &&
      (response.fields !== undefined || response.unmask !== undefined)
    )
      throw Error("INVALID_BODY");
    const fs = list(response.fields).map(object);
    for (const f of fs) {
      exact(f, ["ref", "masking"]);
      ref(f.ref, ["field"]);
      if (f.masking) validateMask(f.masking);
    }
    unique(fs.map((f) => String(object(f.ref).field)));
    const us = list(response.unmask).map((u) => wrapped(u, ["field"]));
    unique(us.map((u) => String(u.field)));
  }
}
function entity(kind: Kind, d: Obj, parent = ""): Entity {
  const localId = id(d.id);
  str(d.name);
  if (d.description !== undefined && typeof d.description !== "string")
    throw Error("INVALID_DESCRIPTION");
  if (d.state !== undefined && !["present", "absent"].includes(String(d.state)))
    throw Error("INVALID_STATE");
  const common = ["id", "name", "description", "state"];
  const extra: Record<Kind, string[]> = {
    workspaces: [],
    services: [],
    domains: [],
    pages: ["path", "actions"],
    "service-endpoints": ["method", "path", "request", "response"],
    actions: ["endpoint"],
    policies: ["effect", "resources"],
  };
  exact(d, [...common, ...extra[kind]]);
  const refs: string[] = [];
  if (parent)
    refs.push(
      key(
        kind === "pages"
          ? "workspaces"
          : kind === "actions"
            ? "domains"
            : "services",
        parent,
      ),
    );
  if (!parent && ["pages", "actions", "service-endpoints"].includes(kind))
    throw Error("MISSING_PARENT");
  if (d.state !== "absent") {
    if (kind === "pages") {
      if (!str(d.path).startsWith("/")) throw Error("INVALID_PATH");
      for (const r of list(d.actions))
        refs.push(actionKey(wrapped(r, ["domain", "action"])));
    }
    if (kind === "service-endpoints") {
      if (
        !str(d.path).startsWith("/") ||
        !["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(
          str(d.method),
        )
      )
        throw Error("INVALID_ENDPOINT");
      validateFields(d.request, "request");
      validateFields(d.response, "response");
    }
    if (kind === "actions") {
      const r = wrapped(d.endpoint, ["service", "endpoint"]);
      refs.push(endpointKey(r));
    }
    if (kind === "policies") {
      validatePolicy(d);
      const r = object(d.resources);
      if (r.page) refs.push(pageKey(wrapped(r.page, ["workspace", "page"])));
      for (const g of grants({ definition: d } as Entity))
        refs.push(actionKey(g.ref));
    }
  }
  unique(refs);
  return {
    key: key(kind, localId, parent),
    kind,
    id: localId,
    parent,
    name: String(d.name),
    definition: d,
    refs,
    absent: d.state === "absent",
  };
}
export function parseSources(sources: string[]): Entity[] {
  const result: Entity[] = [];
  for (const source of sources) {
    if (source.length > 2000000) throw Error("YAML_TOO_LARGE");
    for (const doc of parseAllDocuments(source, { uniqueKeys: true })) {
      if (doc.errors.length) throw Error("INVALID_YAML");
      const root = object(doc.toJS({ maxAliasCount: 0 }));
      const names = Object.keys(root);
      if (
        names.length !== 1 ||
        !["workspace", "service", "domain", "policy"].includes(names[0])
      )
        throw Error("INVALID_DEFINITION");
      const type = names[0],
        d = object(root[type]);
      const child =
        type === "workspace"
          ? "pages"
          : type === "service"
            ? "endpoints"
            : type === "domain"
              ? "actions"
              : null;
      const topKind =
        type === "workspace"
          ? "workspaces"
          : type === "service"
            ? "services"
            : type === "domain"
              ? "domains"
              : "policies";
      const def = { ...d };
      if (child) delete def[child];
      result.push(entity(topKind, def));
      if (child === "actions") {
        for (const [local, value] of Object.entries(
          d.actions === undefined ? {} : object(d.actions),
        )) {
          const action = object(value);
          if ("id" in action) throw Error("ACTION_ID_IS_MAP_KEY");
          result.push(entity("actions", { id: local, ...action }, id(d.id)));
        }
      } else if (child) {
        for (const v of list(d[child]))
          result.push(
            entity(
              child === "pages" ? "pages" : "service-endpoints",
              object(v),
              id(d.id),
            ),
          );
      }
    }
  }
  unique(result.map((e) => e.key));
  return result;
}
export function parseEntities(v: unknown): Entity[] {
  const es = list(v).map((x) => {
    const r = object(x);
    if (!kinds.includes(r.kind as Kind)) throw Error("INVALID_KIND");
    const e = entity(
      r.kind as Kind,
      object(r.definition),
      r.parent === undefined ? "" : String(r.parent),
    );
    if (r.key !== e.key) throw Error("INVALID_KEY");
    return e;
  });
  unique(es.map((e) => e.key));
  return es;
}
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.entries(v)
      .filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, x]) => JSON.stringify(k) + ":" + canonical(x))
      .join(",")}}`;
  return JSON.stringify(v);
}
export function changed(
  a: Entity | null | undefined,
  b: Entity | null | undefined,
) {
  return canonical(a?.definition ?? null) !== canonical(b?.definition ?? null);
}
export function validateCatalog(entities: Entity[]): string[] {
  const live = entities.filter((e) => !e.absent),
    map = new Map(live.map((e) => [e.key, e])),
    errors: string[] = [];
  for (const e of live) {
    for (const r of e.refs) if (!map.has(r)) errors.push(`${e.key} → ${r}`);
    if (e.kind !== "policies") continue;
    const page = e.refs.map((k) => map.get(k)).find((x) => x?.kind === "pages");
    for (const g of grants(e)) {
      const a = map.get(actionKey(g.ref));
      if (page && !page.refs.includes(actionKey(g.ref)))
        errors.push(`${e.key}: PAGE_ACTION_MISMATCH ${actionKey(g.ref)}`);
      if (!a) continue;
      const ep = map.get(
        a.refs.find((k) => k.startsWith("service-endpoints:"))!,
      );
      if (!ep) continue;
      const response = g.response as Obj | undefined;
      if (!response) continue;
      const fs = fields(ep, "response");
      for (const f of [...list(response.fields), ...list(response.unmask)].map(
        object,
      )) {
        const field = String(object(f.ref).field);
        if (!fs[field])
          errors.push(`${e.key}: UNKNOWN_FIELD ${ep.key}/${field}`);
        else if (f.masking && object(fs[field]).type !== "string")
          errors.push(`${e.key}: MASK_TYPE ${field}`);
      }
    }
  }
  return [...new Set(errors)];
}
export function makePlan(
  s: Pick<Snapshot, "applied" | "desired" | "graph">,
  selected: string[],
  restore?: Entity | null,
  restoreKey?: string,
): Plan {
  const applied = new Map(s.applied.map((e) => [e.key, e])),
    desired = new Map(s.desired.map((e) => [e.key, e]));
  const keys = new Set<string>();
  const blockers: string[] = [];
  function include(k: string) {
    if (keys.has(k)) return;
    keys.add(k);
    const e = desired.get(k) ?? applied.get(k);
    if (!e) {
      blockers.push(`UNKNOWN_RESOURCE ${k}`);
      return;
    }
    if (!e.absent) for (const r of e.refs) include(r);
  }
  if (restoreKey) {
    keys.add(restoreKey);
  } else selected.forEach(include);
  const after = new Map(applied);
  for (const k of keys) {
    const e = restoreKey === k ? restore : (desired.get(k) ?? applied.get(k));
    if (!e || e.absent) after.delete(k);
    else after.set(k, e);
  }
  const next = [...after.values()];
  blockers.push(...validateCatalog(next));
  for (const p of s.applied.filter(
    (e) => e.kind === "policies" && !after.has(e.key),
  )) {
    if (s.graph.roles.some((r) => r.bindings.some((b) => b.policyId === p.id)))
      blockers.push(`POLICY_ASSIGNED ${p.id}`);
  }
  const changes = [...keys]
    .map((k) => ({
      key: k,
      before: applied.get(k) ?? null,
      after: after.get(k) ?? null,
    }))
    .filter((c) => changed(c.before, c.after));
  return {
    keys: [...keys],
    selected,
    before: s.applied,
    after: next,
    changes,
    blockers: [...new Set(blockers)],
  };
}
export function dependentPolicies(entities: Entity[], selected: string[]) {
  const map = new Map(entities.map((e) => [e.key, e]));
  function reaches(k: string, seen = new Set<string>()): boolean {
    if (selected.includes(k)) return true;
    if (seen.has(k)) return false;
    seen.add(k);
    return (map.get(k)?.refs ?? []).some((r) => reaches(r, seen));
  }
  return entities.filter((e) => e.kind === "policies" && reaches(e.key));
}
export type Subject = {
  id: string;
  name: string;
  type: "users" | "organizations" | "service-accounts";
  paths: { roleId: string; role: string; policy: Entity }[];
};
export function subjects(
  graph: Graph,
  policies: Entity[],
  now = Date.now(),
): Subject[] {
  const result = new Map<string, Subject>();
  for (const role of graph.roles) {
    for (const binding of role.bindings) {
      if (binding.expiresAt && Date.parse(binding.expiresAt) <= now) continue;
      const policy = policies.find((p) => p.id === binding.policyId);
      if (!policy) continue;
      const targets = [
        ...graph.users
          .filter((x) => role.userIds.includes(x.id))
          .map((x) => ({ ...x, type: "users" as const })),
        ...graph.organizations
          .filter((x) => role.organizationIds.includes(x.id))
          .map((x) => ({ ...x, type: "organizations" as const })),
        ...(graph.serviceAccounts ?? [])
          .filter((x) => x.roleIds.includes(role.id))
          .map((x) => ({ ...x, type: "service-accounts" as const })),
      ];
      for (const t of targets) {
        const k = t.type + ":" + t.id;
        const row = result.get(k) ?? {
          id: t.id,
          name: t.name,
          type: t.type,
          paths: [],
        };
        if (
          !row.paths.some(
            (p) => p.roleId === role.id && p.policy.key === policy.key,
          )
        )
          row.paths.push({ roleId: role.id, role: role.name, policy });
        result.set(k, row);
      }
    }
  }
  return [...result.values()];
}
export function evaluate(
  entities: Entity[],
  policies: Entity[],
  action: string,
) {
  const gs = policies.flatMap((p) =>
    grants(p)
      .filter((g) => actionKey(g.ref) === action)
      .map((g) => ({ p, g })),
  );
  if (gs.some((x) => x.p.definition.effect === "deny"))
    return {
      allowed: false,
      reason: "deny",
      rows: [],
      conflicts: [] as string[],
    };
  const allows = gs.filter((x) => x.p.definition.effect === "allow");
  const callable = allows.some(({ g }) => {
    const r = object(g.response);
    return r.fields !== undefined || r.body === "none";
  });
  const chosen = new Set<string>(),
    unmask = new Set<string>();
  const masks = new Map<string, Obj[]>();
  const via = new Map<string, string[]>();
  for (const { p, g } of allows) {
    const r = object(g.response);
    for (const f of list(r.fields).map(object)) {
      const name = String(object(f.ref).field);
      chosen.add(name);
      via.set(name, [...(via.get(name) ?? []), p.name]);
      if (f.masking)
        masks.set(name, [...(masks.get(name) ?? []), object(f.masking)]);
    }
    for (const f of list(r.unmask).map(object)) {
      const name = String(object(f.ref).field);
      unmask.add(name);
      via.set(name, [...(via.get(name) ?? []), p.name]);
    }
  }
  const epKey = entities
    .find((e) => e.key === action)
    ?.refs.find((k) => k.startsWith("service-endpoints:"));
  const ep = entities.find((e) => e.key === epKey);
  const conflicts: string[] = [];
  const rows = Object.entries(ep ? fields(ep, "response") : {}).map(
    ([field, definition]) => {
      const ms = masks.get(field) ?? [];
      let rule: Obj | undefined;
      let mode = "excluded";
      if (callable && chosen.has(field)) {
        mode = "plain";
        if (unmask.has(field)) mode = "unmask";
        else if (ms.length) {
          const methods = new Set(ms.map((m) => m.method));
          if (methods.has("redact")) {
            rule = ms.find((m) => m.method === "redact");
            mode = "masked";
          } else if (
            methods.size > 1 ||
            new Set(ms.map((m) => m.replacement ?? "*")).size > 1
          ) {
            mode = "conflict";
            conflicts.push(field);
          } else {
            rule = ms.reduce((a, b) =>
              a.method === "keep-last" && Number(b.count) < Number(a.count)
                ? b
                : a,
            );
            mode = "masked";
          }
        }
      }
      return {
        field,
        definition: object(definition),
        mode,
        rule,
        policies: [...new Set(via.get(field) ?? [])],
      };
    },
  );
  return {
    allowed: callable && conflicts.length === 0,
    reason: conflicts.length ? "conflict" : callable ? "allow" : "no-grant",
    rows,
    conflicts,
  };
}
