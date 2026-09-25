"use server";
import { randomUUID, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { deployment } from "@/lib/api/server";
import { getLocale } from "@/i18n/server";
import { requestData, DataApiError } from "@/lib/api/transport";
import { object, type Schema } from "@/lib/api/schema";
import { loadSync } from "../resource-sync/actions";
import { loadPolicySync } from "../policy-sync/actions";
import { resourceSession } from "../resource-sync/demo-store";
import { policySession } from "../policy-sync/demo-store";
import { saveDemoGraph } from "../authorization/demo";
import {
  resourceChanges,
  historyForResource,
  runSchema,
  diff as resourceDiff,
  type Run,
} from "../resource-sync/model";
import { diff as policyDiff } from "../policy-sync/model";
import {
  buildPlan,
  normalizeSelection,
  previewSchema,
  type Context,
  type Selection,
  type Preview,
} from "./model";

type Store = { plans: Map<string, Preview>; runs: Map<string, Run> };
const globals = globalThis as typeof globalThis & {
  orionSyncPlans?: Map<string, Store>;
};
const sessions = (globals.orionSyncPlans ??= new Map());
async function session() {
  const id = (await cookies()).get("orion-demo-access")?.value;
  if (!id) throw Error("CONFLICT");
  if (!sessions.has(id)) {
    if (sessions.size >= 100) sessions.delete(sessions.keys().next().value!);
    sessions.set(id, { plans: new Map(), runs: new Map() });
  }
  return sessions.get(id)!;
}
async function remote<T>(path: string, schema: Schema<T>, body?: unknown) {
  const c = deployment();
  return (
    await requestData(c, path, object({ data: schema }), {
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
    return e.status === 401
      ? "UNAUTHENTICATED"
      : e.status === 403
        ? "FORBIDDEN"
        : e.status === 409
          ? "CONFLICT"
          : "REQUEST_FAILED";
  return e instanceof Error &&
    [
      "CONFLICT",
      "BLOCKED",
      "EXPIRED",
      "INVALID_SELECTION",
      "UNAUTHENTICATED",
      "FORBIDDEN",
    ].includes(e.message)
    ? e.message
    : "REQUEST_FAILED";
}
async function context(input: Selection): Promise<Context> {
  const selection = normalizeSelection(input);
  const r = await loadSync();
  if (!r.data) throw Error(r.error);
  const p = selection.mode === "policies" ? await loadPolicySync() : null;
  if (p && !p.data) throw Error(p.error);
  const result = { selection, resource: r.data, policy: p?.data ?? null };
  buildPlan(result);
  return result;
}
export async function prepareSync(selection: Selection) {
  try {
    return { data: await context(selection) };
  } catch (e) {
    return { error: error(e) };
  }
}
type Request = {
  selection: Selection;
  revision: number;
  resourceCommit: string;
  resourceDigest: string;
  policyCommit: string;
  policyDigest: string;
};
function matches(c: Context, request: Request) {
  const config = deployment();
  for (const snapshot of [c.resource, c.policy])
    if (
      snapshot &&
      (snapshot.digest !==
        createHash("sha256").update(snapshot.yaml).digest("hex") ||
        !Number.isSafeInteger(snapshot.dbRevision))
    )
      return false;
  return (
    c.resource.environment === config.environment &&
    c.resource.region === config.region &&
    c.resource.dbRevision === request.revision &&
    c.resource.candidateCommit === request.resourceCommit &&
    c.resource.digest === request.resourceDigest &&
    (c.policy?.candidateCommit ?? "") === request.policyCommit &&
    (c.policy?.digest ?? "") === request.policyDigest &&
    JSON.stringify(normalizeSelection(c.selection)) ===
      JSON.stringify(normalizeSelection(request.selection))
  );
}
export async function reviewSync(request: Request) {
  try {
    const selection = normalizeSelection(request.selection);
    if (deployment().mode === "api") {
      const p = await remote("sync-plans/previews", previewSchema, {
        ...request,
        selection,
      });
      if (
        !matches(p.context, request) ||
        !Number.isFinite(Date.parse(p.expiresAt)) ||
        Date.parse(p.expiresAt) <= Date.now()
      )
        throw Error("CONFLICT");
      const plan = buildPlan(p.context);
      if (
        plan.blockers.length ||
        (!plan.changedResources.length && !plan.changedPolicies.length)
      )
        throw Error("BLOCKED");
      return { data: p };
    }
    const c = await context(selection);
    if (!matches(c, request)) throw Error("CONFLICT");
    const plan = buildPlan(c);
    if (
      plan.blockers.length ||
      (!plan.changedResources.length && !plan.changedPolicies.length)
    )
      throw Error("BLOCKED");
    const p = {
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      context: c,
    };
    const s = await session();
    if (s.plans.size > 20) s.plans.clear();
    s.plans.set(p.token, p);
    return { data: p };
  } catch (e) {
    return { error: error(e) };
  }
}
export async function applySync(token: string) {
  try {
    if (deployment().mode === "api")
      return {
        data: await remote("sync-plans/runs", runSchema, {
          previewToken: token,
          idempotencyKey: token,
        }),
      };
    const s = await session();
    const existing = s.runs.get(token);
    if (existing) return { data: existing };
    const p = s.plans.get(token);
    if (!p || Date.parse(p.expiresAt) <= Date.now()) throw Error("EXPIRED");
    const c = await context(p.context.selection);
    if (
      c.resource.dbRevision !== p.context.resource.dbRevision ||
      c.resource.digest !== p.context.resource.digest ||
      c.resource.candidateCommit !== p.context.resource.candidateCommit ||
      c.policy?.digest !== p.context.policy?.digest ||
      c.policy?.candidateCommit !== p.context.policy?.candidateCommit
    )
      throw Error("CONFLICT");
    const plan = buildPlan(c);
    if (
      !plan.next ||
      plan.blockers.length ||
      (!plan.changedResources.length && !plan.changedPolicies.length)
    )
      throw Error("BLOCKED");
    const rs = await resourceSession();
    const ps = c.policy ? await policySession() : null;
    const resources = resourceChanges(c.resource.graph, plan.next);
    const run: Run = {
      id: token,
      status: "succeeded",
      phase: "database",
      message: "DEMO_APPLIED",
      commit: c.policy?.candidateCommit ?? c.resource.candidateCommit,
      dbRevision: plan.next.revision,
      completedAt: new Date().toISOString(),
      rollbackOf: undefined,
      targetRevision: undefined,
      resources,
    };
    // One compare-and-swap writes both definition sets; never execute two independent Syncs.
    await saveDemoGraph(plan.next, c.resource.dbRevision);
    if (resources.length) {
      const initial = resources.filter(
        (ref) =>
          !historyForResource([...rs.runs.values()], ref.kind, ref.id).length,
      );
      if (initial.length) {
        const baseline: Run = {
          ...run,
          id: randomUUID(),
          phase: "baseline",
          message: "INITIAL_VERSION",
          commit: c.resource.appliedCommit,
          dbRevision: c.resource.dbRevision,
          completedAt: undefined,
          resources: initial.map((ref) => ({ ...ref, after: ref.before })),
        };
        rs.runs.set(baseline.id, baseline);
        rs.snapshots.set(baseline.id, c.resource.graph);
      }
      rs.runs.set(run.id, { ...run, commit: c.resource.candidateCommit });
      rs.snapshots.set(run.id, plan.next);
      if (
        !resourceDiff({
          ...c.resource,
          graph: plan.next,
          dbRevision: plan.next.revision,
        }).rows.some((r) => r.operation !== "unchanged")
      )
        rs.applied = c.resource.candidateCommit;
    }
    if (ps && c.policy) {
      ps.runs.set(run.id, {
        ...run,
        policyIds: plan.policies.map((p) => p.after.id),
        resourceRefs: resources.map((r) => ({ kind: r.kind, id: r.id })),
      });
      ps.snapshots.set(run.id, plan.next);
      if (
        !policyDiff({
          ...c.policy,
          graph: plan.next,
          dbRevision: plan.next.revision,
        }).rows.some((r) => r.operation !== "unchanged")
      )
        ps.applied = c.policy.candidateCommit;
    }
    s.runs.set(run.id, run);
    s.plans.delete(token);
    revalidatePath("/", "layout");
    return { data: run };
  } catch (e) {
    return { error: error(e) };
  }
}
export async function syncPlanRun(id: string) {
  try {
    if (deployment().mode === "api")
      return {
        data: await remote(
          `sync-plans/runs/${encodeURIComponent(id)}`,
          runSchema,
        ),
      };
    const run = (await session()).runs.get(id);
    if (!run) throw Error("CONFLICT");
    return { data: run };
  } catch (e) {
    return { error: error(e) };
  }
}
