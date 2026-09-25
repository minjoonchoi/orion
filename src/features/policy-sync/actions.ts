"use server";
import { policySession as session } from "./demo-store";
import { resourceSession } from "../resource-sync/demo-store";
import { resourceChanges } from "../resource-sync/model";
import { restorePlan } from "../sync-workflow/model";
import { restoreDefinitions } from "../authorization/rollback";
import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { deployment } from "@/lib/api/server";
import { requestData, DataApiError } from "@/lib/api/transport";
import { getLocale } from "@/i18n/server";
import { object, array, type Schema } from "@/lib/api/schema";
import {
  initialGraph,
  existingGraph,
  saveDemoGraph,
} from "../authorization/demo";
import {
  snapshotSchema,
  previewSchema,
  runSchema,
  diff,
  applySnapshot,
  policyYamlForScope,
  type Snapshot,
  type Run,
} from "./model";

function digestOf(yaml: string) {
  return createHash("sha256").update(yaml).digest("hex");
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
    ["CONFLICT", "BLOCKED", "EXPIRED"].includes(e.message)
    ? e.message
    : "REQUEST_FAILED";
}

function validateSnapshot(s: Snapshot) {
  const c = deployment();
  if (
    s.environment !== c.environment ||
    s.region !== c.region ||
    s.digest !== digestOf(s.yaml) ||
    !Number.isSafeInteger(s.dbRevision)
  )
    throw Error("CONFLICT");
  diff(s);
  return s;
}

async function snapshot(): Promise<Snapshot> {
  if (deployment().mode === "api")
    return validateSnapshot(await remote("policy-sync/status", snapshotSchema));
  const c = deployment();
  let graph = await existingGraph();
  if (!graph) {
    graph = await initialGraph();
    await saveDemoGraph(graph);
  }
  const raw = await readFile(
    process.cwd() + "/config/policies/orion-policies.yaml",
    "utf8",
  );
  const yaml = policyYamlForScope(raw, c.environment, c.region);
  const digest = digestOf(yaml);
  const s = await session();
  return validateSnapshot({
    dbRevision: graph.revision,
    appliedCommit: s.applied,
    candidateCommit: "demo-policy-merged-" + digest.slice(0, 12),
    digest,
    environment: c.environment,
    region: c.region,
    cloudConfig: "ready",
    yaml,
    graph,
  });
}

export async function loadPolicySync() {
  try {
    return { data: await snapshot() };
  } catch (e) {
    return { error: error(e) };
  }
}

export async function previewPolicySync(
  commit: string,
  digest: string,
  revision: number,
) {
  try {
    if (deployment().mode === "api") {
      const p = await remote("policy-sync/previews", previewSchema, {
        commit,
        digest,
        expectedDbRevision: revision,
      });
      validateSnapshot(p.snapshot);
      if (
        p.snapshot.candidateCommit !== commit ||
        p.snapshot.digest !== digest ||
        p.snapshot.dbRevision !== revision ||
        !Number.isFinite(Date.parse(p.expiresAt)) ||
        Date.parse(p.expiresAt) <= Date.now()
      )
        throw Error("CONFLICT");
      if (diff(p.snapshot).blockers.length) throw Error("BLOCKED");
      return { data: p };
    }
    const snap = await snapshot();
    if (
      snap.candidateCommit !== commit ||
      snap.digest !== digest ||
      snap.dbRevision !== revision
    )
      throw Error("CONFLICT");
    if (
      diff(snap).blockers.length ||
      !diff(snap).rows.some((r) => r.operation !== "unchanged")
    )
      throw Error("BLOCKED");
    const p = {
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      snapshot: snap,
    };
    const s = await session();
    if (s.plans.size > 20) s.plans.clear();
    s.plans.set(p.token, p);
    return { data: p };
  } catch (e) {
    return { error: error(e) };
  }
}

export async function executePolicySync(token: string) {
  try {
    if (deployment().mode === "api")
      return {
        data: await remote("policy-sync/runs", runSchema, {
          previewToken: token,
          idempotencyKey: token,
        }),
      };
    const s = await session();
    const previous = s.runs.get(token);
    if (previous) return { data: previous };
    const p = s.plans.get(token);
    if (!p || Date.parse(p.expiresAt) < Date.now()) throw Error("EXPIRED");
    const snap = await snapshot();
    if (
      snap.dbRevision !== p.snapshot.dbRevision ||
      snap.digest !== p.snapshot.digest
    )
      throw Error("CONFLICT");
    const next = applySnapshot(snap);
    await saveDemoGraph(next, snap.dbRevision);
    s.applied = snap.candidateCommit;
    const run: Run = {
      id: token,
      status: "succeeded",
      phase: "database",
      message: "DEMO_APPLIED",
      commit: snap.candidateCommit,
      dbRevision: next.revision,
      rollbackOf: undefined,
      targetRevision: undefined,
      policyIds: undefined,
      resourceRefs: undefined,
      completedAt: new Date().toISOString(),
    };
    s.runs.set(token, run);
    s.snapshots.set(run.id, next);
    s.plans.delete(token);
    revalidatePath("/", "layout");
    return { data: run };
  } catch (e) {
    return { error: error(e) };
  }
}

export async function policySyncRun(id: string) {
  try {
    if (deployment().mode === "api")
      return {
        data: await remote(
          "policy-sync/runs/" + encodeURIComponent(id),
          runSchema,
        ),
      };
    const run = (await session()).runs.get(id);
    if (!run) throw Error();
    return { data: run };
  } catch (e) {
    return { error: error(e) };
  }
}

export async function policySyncHistory() {
  try {
    if (deployment().mode === "api")
      return { data: await remote("policy-sync/runs", array(runSchema)) };
    await snapshot();
    return { data: [...(await session()).runs.values()].reverse() };
  } catch (e) {
    return { error: error(e) };
  }
}

export async function rollbackPolicySync(runId: string) {
  try {
    if (deployment().mode === "api")
      return {
        data: await remote("policy-sync/rollbacks", runSchema, {
          runId,
          idempotencyKey: `rollback:${runId}`,
        }),
      };
    const s = await session();
    const target = s.snapshots.get(runId);
    const targetRun = s.runs.get(runId);
    if (!target || !targetRun || targetRun.status !== "succeeded")
      throw Error("CONFLICT");
    const snap = await snapshot();
    const next = targetRun.policyIds
      ? restorePlan(
          snap.graph,
          target,
          targetRun.policyIds,
          targetRun.resourceRefs ?? [],
        )
      : restoreDefinitions(snap.graph, target, "policies");
    const rs = await resourceSession();
    await saveDemoGraph(next, snap.graph.revision);
    if (!targetRun.policyIds) s.applied = targetRun.commit;
    const run: Run = {
      id: randomUUID(),
      status: "succeeded",
      phase: "rollback",
      message: "DEMO_ROLLED_BACK",
      commit: targetRun.commit,
      dbRevision: next.revision,
      rollbackOf: runId,
      targetRevision: target.revision,
      policyIds: targetRun.policyIds,
      resourceRefs: targetRun.resourceRefs,
      completedAt: new Date().toISOString(),
    };
    s.runs.set(run.id, run);
    s.snapshots.set(run.id, next);
    const resources = resourceChanges(snap.graph, next);
    if (resources.length) {
      rs.runs.set(run.id, { ...run, resources });
      rs.snapshots.set(run.id, next);
    }
    revalidatePath("/", "layout");
    return { data: run };
  } catch (e) {
    return { error: error(e) };
  }
}
