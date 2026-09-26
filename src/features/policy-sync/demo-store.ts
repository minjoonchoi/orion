import "server-only";
import { cookies } from "next/headers";
import type { Preview, Run, Snapshot } from "./model";
const state = globalThis as typeof globalThis & {
  orionPolicySync?: Map<
    string,
    {
      applied: string;
      plans: Map<string, Preview>;
      runs: Map<string, Run>;
      snapshots: Map<string, Snapshot["graph"]>;
    }
  >;
};
const sessions: NonNullable<typeof state.orionPolicySync> =
  (state.orionPolicySync ??= new Map());

export async function policySession() {
  const id = (await cookies()).get("orion-demo-access")?.value;
  if (!id) throw Error("CONFLICT");
  if (!sessions.has(id)) {
    if (sessions.size >= 100) sessions.delete(sessions.keys().next().value!);
    sessions.set(id, {
      applied: "demo-policy-baseline",
      plans: new Map(),
      runs: new Map(),
      snapshots: new Map(),
    });
  }
  const entry = sessions.get(id)!;
  entry.snapshots ??= new Map();
  return entry;
}
