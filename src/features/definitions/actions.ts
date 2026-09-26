"use server";
import { readFile, readdir } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { deployment } from "@/lib/api/server";
import { requestData, DataApiError } from "@/lib/api/transport";
import { getLocale } from "@/i18n/server";
import { object as schemaObject, type Schema } from "@/lib/api/schema";
import {
  existingGraph,
  initialGraph,
  saveDemoGraph,
} from "../authorization/demo";
import { graphSchema, type Graph } from "../authorization/model";
import {
  parseSources,
  parseEntities,
  validateCatalog,
  makePlan,
  object,
  str,
  changed,
  evaluate,
  subjects,
  actionKey,
  type Snapshot,
  type Entity,
  type History,
  type Preview,
} from "./model";
type Session = {
  applied: Entity[];
  history: History[];
  plans: Map<string, Preview>;
};
const root = globalThis as typeof globalThis & {
  orionDefinitions?: Map<string, Session>;
};
const store = (root.orionDefinitions ??= new Map<string, Session>());
function parseSnapshot(v: unknown): Snapshot {
  const o = object(v);
  const applied = parseEntities(o.applied),
    desired = parseEntities(o.desired);
  const graph = graphSchema.parse(o.graph);
  if (!Number.isSafeInteger(o.revision) || Number(o.revision) < 0)
    throw Error("INVALID_REVISION");
  const c = deployment();
  if (o.environment !== c.environment || o.region !== c.region)
    throw Error("SCOPE_MISMATCH");
  if (!Array.isArray(o.history)) throw Error("INVALID_HISTORY");
  const history = o.history.map((x) => {
    const h = object(x);
    if (!Number.isSafeInteger(h.revision)) throw Error("INVALID_REVISION");
    const definition =
      h.definition === null ? null : parseEntities([h.definition])[0];
    const key = str(h.key);
    if (definition && definition.key !== key)
      throw Error("INVALID_HISTORY_KEY");
    return {
      key,
      revision: Number(h.revision),
      at: str(h.at),
      actor: str(h.actor),
      execution: str(h.execution),
      source: str(h.source),
      definition,
    };
  });
  if (validateCatalog(applied).length) throw Error("INVALID_APPLIED_CATALOG");
  return {
    revision: Number(o.revision),
    sourceRevision: str(o.sourceRevision),
    environment: c.environment,
    region: c.region,
    applied,
    desired,
    graph,
    history,
  };
}
async function remote<T>(path: string, schema: Schema<T>, body?: unknown) {
  const c = deployment();
  return (
    await requestData(c, path, schemaObject({ data: schema }), {
      locale: await getLocale(),
      session: c.sessionCookie
        ? (await cookies()).get(c.sessionCookie)?.value
        : undefined,
      ...(body === undefined ? {} : { method: "POST" as const, body }),
    })
  ).data;
}
function error(e: unknown) {
  if (e instanceof DataApiError)
    return e.status === 403
      ? "FORBIDDEN"
      : e.status === 401
        ? "UNAUTHENTICATED"
        : e.status === 409
          ? "CONFLICT"
          : "REQUEST_FAILED";
  return e instanceof Error ? e.message : "REQUEST_FAILED";
}
function project(graph: Graph, entities: Entity[]): Graph {
  const resources = entities
    .filter((e) =>
      [
        "workspaces",
        "pages",
        "services",
        "service-endpoints",
        "domains",
        "actions",
      ].includes(e.kind),
    )
    .map((e) => ({
      id: e.parent ? e.parent + "~" + e.id : e.id,
      kind: e.kind as Graph["resources"][number]["kind"],
      name: e.name,
      description: String(e.definition.description ?? ""),
      path: String(e.definition.path ?? ""),
      method: String(e.definition.method ?? ""),
      parentId: e.parent,
    }));
  const policies = entities
    .filter((e) => e.kind === "policies")
    .map((e) => ({
      id: e.id,
      name: e.name,
      description: String(e.definition.description ?? ""),
      effect: e.definition.effect as "allow" | "deny",
      resources: resources
        .filter((r) =>
          e.refs.some(
            (k) =>
              k ===
              r.kind +
                ":" +
                (r.parentId ? r.parentId + "/" : "") +
                (r.parentId ? r.id.slice(r.parentId.length + 1) : r.id),
          ),
        )
        .map((r) => ({ kind: r.kind, id: r.id })),
    }));
  return {
    ...graph,
    resources,
    policies,
    roles: graph.roles.map((role) => ({
      ...role,
      bindings: role.bindings.filter((b) =>
        policies.some((p) => p.id === b.policyId),
      ),
    })),
  };
}
async function snapshot(): Promise<Snapshot> {
  if (deployment().mode === "api")
    return remote("definitions/status", { parse: parseSnapshot });
  let graph = await existingGraph();
  if (!graph) {
    const stale = (await cookies()).get("orion-demo-access")?.value;
    if (stale) store.delete(stale);
    graph = await initialGraph();
    await saveDemoGraph(graph);
  }
  const jar = await cookies(),
    sessionId = jar.get("orion-demo-access")!.value;
  const directory = process.cwd() + "/config/definitions";
  const names = (await readdir(directory))
    .filter((n) => /\.ya?ml$/.test(n))
    .sort();
  const sources = await Promise.all(
    names.map((n) => readFile(directory + "/" + n, "utf8")),
  );
  const desired = parseSources(sources);
  const sourceRevision =
    "demo-" + createHash("sha256").update(sources.join("\n")).digest("hex");
  let s = store.get(sessionId);
  if (!s) {
    const applied = structuredClone(desired.filter((e) => !e.absent));
    const p = applied.find((e) => e.id === "policy-platform")!;
    const r = object(
      object((object(p.definition.resources).actions as unknown[])[0]).response,
    );
    r.fields = (r.fields as unknown[]).filter(
      (f) => object(object(f).ref).field !== "phone",
    );
    const ep = applied.find(
      (e) => e.key === "service-endpoints:identity-api/detail",
    )!;
    ep.definition.name = "사용자 기본 정보 조회";
    ep.name = String(ep.definition.name);
    const previousRevision = graph.revision;
    graph = project({ ...graph, revision: previousRevision + 1 }, applied);
    await saveDemoGraph(graph, previousRevision);
    s = {
      applied,
      history: applied.map((e) => ({
        key: e.key,
        revision: 0,
        at: "2026-09-25T00:00:00Z",
        actor: "demo",
        execution: "baseline",
        source: "demo-baseline",
        definition: structuredClone(e),
      })),
      plans: new Map(),
    };
    if (store.size >= 100) store.delete(store.keys().next().value!);
    store.set(sessionId, s);
  }
  const c = deployment();
  return {
    revision: graph.revision,
    sourceRevision,
    environment: c.environment,
    region: c.region,
    applied: s.applied,
    desired,
    history: s.history,
    graph,
  };
}
export async function loadDefinitions() {
  try {
    return { data: await snapshot() };
  } catch (e) {
    return { error: error(e) };
  }
}
export async function previewDefinitions(
  selected: string[],
  restore?: { key: string; revision: number },
) {
  try {
    if (
      !Array.isArray(selected) ||
      !selected.length ||
      selected.some((k) => typeof k !== "string")
    )
      throw Error("EMPTY_SELECTION");
    const s = await snapshot();
    if (deployment().mode === "api")
      return {
        data: await remote(
          "definitions/previews",
          {
            parse(v) {
              const p = object(v),
                plan = object(p.plan);
              if (
                p.revision !== s.revision ||
                p.sourceRevision !== s.sourceRevision
              )
                throw Error("CONFLICT");
              const before = parseEntities(plan.before),
                after = parseEntities(plan.after);
              if (
                !Array.isArray(plan.keys) ||
                !Array.isArray(plan.selected) ||
                !Array.isArray(plan.blockers)
              )
                throw Error("INVALID_PLAN");
              const keys = plan.keys.map(str),
                chosen = plan.selected.map(str);
              if (
                selected.some((k) => !chosen.includes(k)) ||
                chosen.some((k) => !selected.includes(k))
              )
                throw Error("INVALID_SELECTION");
              const allKeys = [
                ...new Set([...before, ...after].map((e) => e.key)),
              ];
              const changes = allKeys
                .map((key) => ({
                  key,
                  before: before.find((e) => e.key === key) ?? null,
                  after: after.find((e) => e.key === key) ?? null,
                }))
                .filter((c) => changed(c.before, c.after));
              if (changes.some((c) => !keys.includes(c.key)))
                throw Error("INVALID_PLAN_SCOPE");
              const expiresAt = str(p.expiresAt);
              if (!Number.isFinite(Date.parse(expiresAt)))
                throw Error("INVALID_EXPIRY");
              return {
                token: str(p.token),
                expiresAt,
                revision: s.revision,
                sourceRevision: s.sourceRevision,
                plan: {
                  keys,
                  selected: chosen,
                  before,
                  after,
                  changes,
                  blockers: [
                    ...plan.blockers.map(str),
                    ...validateCatalog(after),
                  ],
                },
              };
            },
          },
          {
            selected,
            restore,
            expectedRevision: s.revision,
            sourceRevision: s.sourceRevision,
          },
        ),
      };
    const target = restore
      ? s.history.find(
          (h) => h.key === restore.key && h.revision === restore.revision,
        )
      : undefined;
    if (restore && !target) throw Error("UNKNOWN_REVISION");
    const plan = makePlan(s, selected, target?.definition, restore?.key);
    const p: Preview = {
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      revision: s.revision,
      sourceRevision: s.sourceRevision,
      plan,
    };
    const state = store.get((await cookies()).get("orion-demo-access")!.value)!;
    for (const [k, v] of state.plans)
      if (Date.parse(v.expiresAt) < Date.now()) state.plans.delete(k);
    state.plans.set(p.token, p);
    return { data: p };
  } catch (e) {
    return { error: error(e) };
  }
}
export async function applyDefinitions(token: string) {
  try {
    if (deployment().mode === "api")
      return {
        data: await remote(
          "definitions/applications",
          { parse: parseSnapshot },
          { token },
        ),
      };
    const snap = await snapshot();
    const state = store.get((await cookies()).get("orion-demo-access")!.value)!;
    const p = state.plans.get(token);
    if (!p || Date.parse(p.expiresAt) < Date.now()) throw Error("EXPIRED");
    if (
      p.revision !== snap.revision ||
      p.sourceRevision !== snap.sourceRevision
    )
      throw Error("CONFLICT");
    if (p.plan.blockers.length || !p.plan.changes.length)
      throw Error("BLOCKED");
    const next = new Map(snap.applied.map((e) => [e.key, e]));
    for (const c of p.plan.changes) {
      if (c.after) next.set(c.key, c.after);
      else next.delete(c.key);
    }
    const applied = [...next.values()];
    if (validateCatalog(applied).length) throw Error("BLOCKED");
    const graph = project(
      { ...snap.graph, revision: snap.graph.revision + 1 },
      applied,
    );
    for (const c of p.plan.changes.filter(
      (c) => !c.after && c.before?.kind === "policies",
    ))
      graph.policies = graph.policies.filter((x) => x.id !== c.before!.id);
    await saveDemoGraph(graph, snap.revision);
    state.applied = structuredClone(applied);
    state.history.push(
      ...p.plan.changes.map((c) => ({
        key: c.key,
        revision: graph.revision,
        at: new Date().toISOString(),
        actor: "demo-operator",
        execution: token,
        source: snap.sourceRevision,
        definition: structuredClone(c.after),
      })),
    );
    state.plans.delete(token);
    revalidatePath("/", "layout");
    return { data: await snapshot() };
  } catch (e) {
    return { error: error(e) };
  }
}

export async function evaluateDefinitionAccess(
  subject: { type: string; id: string },
  ref: { domain: string; action: string },
) {
  try {
    if (!["users", "organizations", "service-accounts"].includes(subject.type))
      throw Error("INVALID_SUBJECT");
    const action = actionKey(ref);
    if (deployment().mode === "api")
      return {
        data: await remote(
          "definitions/evaluations",
          {
            parse(value) {
              const r = object(value);
              if (
                typeof r.allowed !== "boolean" ||
                !Array.isArray(r.rows) ||
                !Array.isArray(r.conflicts)
              )
                throw Error("INVALID_EVALUATION");
              return {
                allowed: r.allowed,
                reason: str(r.reason),
                conflicts: r.conflicts.map(str),
                rows: r.rows.map((v) => {
                  const row = object(v);
                  if (
                    ![
                      "plain",
                      "masked",
                      "unmask",
                      "excluded",
                      "conflict",
                    ].includes(str(row.mode)) ||
                    !Array.isArray(row.policies)
                  )
                    throw Error("INVALID_EVALUATION");
                  return {
                    field: str(row.field),
                    definition: object(row.definition),
                    mode: str(row.mode),
                    rule: row.rule ? object(row.rule) : undefined,
                    policies: row.policies.map(str),
                  };
                }),
              };
            },
          },
          { subject, action: { ref } },
        ),
      };
    const s = await snapshot();
    const person = subjects(
      s.graph,
      s.applied.filter((e) => e.kind === "policies"),
    ).find((p) => p.type === subject.type && p.id === subject.id);
    const policies = person
      ? [...new Map(person.paths.map((p) => [p.policy.key, p.policy])).values()]
      : [];
    return { data: evaluate(s.applied, policies, action) };
  } catch (e) {
    return { error: error(e) };
  }
}
