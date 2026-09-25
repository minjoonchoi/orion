"use server";
import { restoreResource } from "./restore";
import { resourceKinds, type ResourceKind } from "../authorization/model";
import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { stringify } from "yaml";
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
  parseBundle,
  resourceChanges,
  historyForResource,
  type Snapshot,
  type Preview,
  type Run,
} from "./model";
const state = globalThis as typeof globalThis & {
  orionSync?: Map<
    string,
    {
      applied: string;
      plans: Map<string, Preview>;
      runs: Map<string, Run>;
      snapshots: Map<string, Snapshot["graph"]>;
    }
  >;
};
const sessions = (state.orionSync ??= new Map());
async function session() {
  const id = (await cookies()).get("orion-demo-access")?.value;
  if (!id) throw Error("CONFLICT");
  if (!sessions.has(id)) {
    if (sessions.size >= 100) sessions.delete(sessions.keys().next().value!);
    sessions.set(id, {
      applied: "demo-db-baseline",
      plans: new Map(),
      runs: new Map(),
      snapshots: new Map(),
    });
  }
  const entry = sessions.get(id)!;
  entry.snapshots ??= new Map();
  return entry;
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
    s.digest !== createHash("sha256").update(s.yaml).digest("hex") ||
    !Number.isSafeInteger(s.dbRevision)
  )
    throw Error("CONFLICT");
  diff(s);
  return s;
}
async function snapshot(): Promise<Snapshot> {
  if (deployment().mode === "api")
    return validateSnapshot(
      await remote("resource-sync/status", snapshotSchema),
    );
  const c = deployment();
  let graph = await existingGraph();
  if (!graph) {
    graph = await initialGraph();
    await saveDemoGraph(graph);
  }
  const raw = await readFile(
    process.cwd() + "/config/resources/orion-resources.yaml",
    "utf8",
  );
  const bundle = parseBundle(raw, "development", "ap-northeast-2");
  bundle.metadata.environment = c.environment;
  bundle.metadata.region = c.region;
  const yaml = stringify(bundle);
  const digest = createHash("sha256").update(yaml).digest("hex");
  const s = await session();
  return {
    dbRevision: graph.revision,
    appliedCommit: s.applied,
    candidateCommit: "demo-merged-" + digest.slice(0, 12),
    digest,
    environment: c.environment,
    region: c.region,
    cloudConfig: "ready",
    yaml,
    graph,
  };
}
export async function loadSync() {
  try {
    return { data: await snapshot() };
  } catch (e) {
    return { error: error(e) };
  }
}
export async function previewSync(
  commit: string,
  digest: string,
  revision: number,
) {
  try {
    if (deployment().mode === "api") {
      const p = await remote("resource-sync/previews", previewSchema, {
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
export async function executeSync(token: string) {
  try {
    if (deployment().mode === "api")
      return {
        data: await remote("resource-sync/runs", runSchema, {
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
    const resources = resourceChanges(snap.graph, next);
    await saveDemoGraph(next, snap.dbRevision);
    // Preserve the first known version, including absence before creation.
    const initial = resources.filter(
      (ref) =>
        !historyForResource([...s.runs.values()], ref.kind, ref.id).length,
    );
    if (initial.length) {
      const baseline: Run = {
        id: randomUUID(),
        status: "succeeded",
        phase: "baseline",
        message: "INITIAL_VERSION",
        commit: snap.appliedCommit,
        dbRevision: snap.dbRevision,
        completedAt: undefined,
        rollbackOf: undefined,
        targetRevision: undefined,
        resources: initial.map((ref) => ({ ...ref, after: ref.before })),
      };
      s.runs.set(baseline.id, baseline);
      s.snapshots.set(baseline.id, snap.graph);
    }
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
      completedAt: new Date().toISOString(),
      resources,
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
export async function syncRun(id: string) {
  try {
    if (deployment().mode === "api")
      return {
        data: await remote(
          "resource-sync/runs/" + encodeURIComponent(id),
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

export async function syncHistory(kind: string, id: string) {
  try {
    if (!resourceKinds.includes(kind as ResourceKind) || !id)
      throw Error("BLOCKED");
    if (deployment().mode === "api") {
      const runs = await remote(
        `resource-sync/runs?kind=${encodeURIComponent(kind)}&resourceId=${encodeURIComponent(id)}`,
        array(runSchema),
      );
      // Do not fall back to unscoped records from an older API server.
      if (
        runs.some(
          (run) =>
            !run.resources?.some((ref) => ref.kind === kind && ref.id === id),
        )
      )
        throw Error("CONFLICT");
      return { data: historyForResource(runs, kind, id) };
    }
    await snapshot();
    return {
      data: historyForResource(
        [...(await session()).runs.values()].reverse(),
        kind,
        id,
      ),
    };
  } catch (e) {
    return { error: error(e) };
  }
}

export async function rollbackSync(
  runId: string,
  kind: ResourceKind,
  id: string,
  expectedDbRevision: number,
) {
  try {
    if (
      !resourceKinds.includes(kind) ||
      !id ||
      !Number.isSafeInteger(expectedDbRevision)
    )
      throw Error("BLOCKED");
    if (deployment().mode === "api")
      return {
        data: await remote(
          `resource-sync/resources/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/rollbacks`,
          runSchema,
          {
            runId,
            kind,
            resourceId: id,
            expectedDbRevision,
            idempotencyKey: `rollback:${runId}:${kind}:${id}:${expectedDbRevision}`,
          },
        ),
      };
    const s = await session();
    const target = s.snapshots.get(runId);
    const targetRun = s.runs.get(runId);
    if (
      !target ||
      !targetRun ||
      targetRun.status !== "succeeded" ||
      !historyForResource([targetRun], kind, id).length
    )
      throw Error("CONFLICT");
    const snap = await snapshot();
    if (snap.dbRevision !== expectedDbRevision) throw Error("CONFLICT");
    const next = restoreResource(snap.graph, target, kind, id);
    const resources = resourceChanges(snap.graph, next);
    if (!resources.length) throw Error("BLOCKED");
    await saveDemoGraph(next, snap.graph.revision);
    const run: Run = {
      id: randomUUID(),
      status: "succeeded",
      phase: "rollback",
      message: "DEMO_ROLLED_BACK",
      commit: targetRun.commit,
      dbRevision: next.revision,
      rollbackOf: runId,
      targetRevision: target.revision,
      completedAt: new Date().toISOString(),
      resources,
    };
    s.runs.set(run.id, run);
    s.snapshots.set(run.id, next);
    revalidatePath("/", "layout");
    return { data: run };
  } catch (e) {
    return { error: error(e) };
  }
}
