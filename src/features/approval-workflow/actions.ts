"use server";
import { cookies } from "next/headers";
import { randomUUID, createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { deployment } from "@/lib/api/server";
import { requestData } from "@/lib/api/transport";
import { object, string, enumeration, optional } from "@/lib/api/schema";
import { getLocale } from "@/i18n/server";
import { rawState } from "./server";
import { apply, type Command } from "./model";
export async function workflowCommand(
  command: Command,
  expectedRevision: number,
) {
  try {
    const config = deployment(),
      jar = await cookies();
    if (config.mode === "api") {
      // Backend owns identity, ACL, snapshot validation and atomic provisioning.
      const result = await requestData(
        config,
        "approval-workflow/commands",
        object({ status: enumeration(["ok"]), hash: optional(string) }),
        {
          method: "POST",
          body: { command, expectedRevision },
          locale: await getLocale(),
          session: config.sessionCookie
            ? jar.get(config.sessionCookie)?.value
            : undefined,
        },
      );
      if (command.kind === "execute" && command.secretText && !result.hash)
        throw Error("MISSING_HASH");
    } else {
      const state = await rawState();
      const hash =
        command.kind === "execute" && command.secretText
          ? `demo-sha256:${createHash("sha256").update(command.secretText).digest("hex")}`
          : "";
      const updated = apply(
        state,
        command,
        expectedRevision,
        new Date().toISOString(),
        hash,
      );
      const { sessions } = await import("./demo");
      let id = jar.get("orion-approval-workflow")?.value;
      if (!id) {
        id = randomUUID();
        jar.set("orion-approval-workflow", id, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 86400,
          secure: process.env.ORION_ENVIRONMENT === "production",
        });
      }
      for (const [key, v] of sessions)
        if (Date.now() - v.at > 86400000) sessions.delete(key);
      if (sessions.size >= 100 && !sessions.has(id))
        throw Error("SESSION_LIMIT");
      if (
        sessions.has(id) &&
        sessions.get(id)!.state.revision !== expectedRevision
      )
        throw Error("REVISION_CONFLICT");
      // No raw key or simulated Secret value is retained in demo state.
      sessions.set(id, { state: updated, at: Date.now() });
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    const known = [
      "REVISION_CONFLICT",
      "FORBIDDEN",
      "INVALID_INPUT",
      "INVALID_ENDPOINT",
      "INVALID_SECRET",
      "INVALID_KEY",
      "INVALID_STATE",
      "PAIR_EXISTS",
      "REQUEST_PENDING",
      "UNRESOLVED_LINE",
      "INVALID_TEMPLATE",
      "INVALID_TARGET",
      "CONFLICT",
      "SECRET_IN_USE",
    ];
    return {
      error:
        e instanceof Error && known.includes(e.message)
          ? e.message
          : "REQUEST_FAILED",
    };
  }
}
export async function demoActor(userId: string) {
  if (deployment().mode !== "demo") return { error: "FORBIDDEN" };
  const s = await rawState();
  if (!s.users.some((u) => u.id === userId)) return { error: "FORBIDDEN" };
  const { sessions } = await import("./demo");
  const jar = await cookies();
  let id = jar.get("orion-approval-workflow")?.value;
  if (!id) {
    id = randomUUID();
    jar.set("orion-approval-workflow", id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
      secure: process.env.ORION_ENVIRONMENT === "production",
    });
  }
  sessions.set(id, {
    state: { ...s, actorId: userId, revision: s.revision + 1 },
    at: Date.now(),
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
