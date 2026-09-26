"use server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { loadDirectory } from "./repository";
import {
  validateDirectory,
  changeRecipients,
  type RecipientChange,
} from "./model";
import { deployment } from "@/lib/api/server";
import { requestData } from "@/lib/api/transport";
import { getLocale } from "@/i18n/server";
import { object } from "@/lib/api/schema";
export async function saveRecipients(change: RecipientChange) {
  try {
    const d = await loadDirectory();
    const updated = changeRecipients(d, change);
    const config = deployment(),
      jar = await cookies();
    if (config.mode === "api")
      await requestData(
        config,
        change.kind === "members"
          ? `platforms/${encodeURIComponent(change.platformId)}/members`
          : `platforms/${encodeURIComponent(change.platformId)}/roles/${encodeURIComponent(change.roleId!)}/users`,
        object({ data: { parse: validateDirectory } }),
        {
          method: "POST",
          body: {
            userIds: change.userIds,
            operation: change.operation,
            expectedRevision: change.expectedRevision,
          },
          locale: await getLocale(),
          session: config.sessionCookie
            ? jar.get(config.sessionCookie)?.value
            : undefined,
        },
      );
    else {
      const { directories } = await import("./demo");
      let id = jar.get("orion-platform-demo")?.value;
      if (!id) {
        id = randomUUID();
        jar.set("orion-platform-demo", id, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 86400,
          secure: process.env.ORION_ENVIRONMENT === "production",
        });
      }
      if (directories.size >= 100 && !directories.has(id))
        directories.delete(directories.keys().next().value!);
      directories.set(id, updated);
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return {
      error:
        e instanceof Error && e.message === "REVISION_CONFLICT"
          ? "정보가 변경되었습니다. 새로고침 후 다시 시도하세요."
          : "변경사항을 저장하지 못했습니다.",
    };
  }
}
