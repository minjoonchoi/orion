"use server";
import { cookies } from "next/headers";
import { deployment } from "@/lib/api/server";
import { requestData, DataApiError } from "@/lib/api/transport";
import { object, enumeration } from "@/lib/api/schema";
import { getLocale } from "@/i18n/server";
import { clearDemo } from "@/features/authorization/demo";
export async function logout(): Promise<{ ok: boolean }> {
  const config = deployment();
  const jar = await cookies();
  if (config.mode === "api") {
    try {
      await requestData(
        config,
        "auth/logout",
        {
          parse: (value: unknown) =>
            value === undefined
              ? { status: "signed_out" }
              : object({ status: enumeration(["signed_out"]) }).parse(value),
        },
        {
          locale: await getLocale(),
          method: "POST",
          body: {},
          session: config.sessionCookie
            ? jar.get(config.sessionCookie)?.value
            : undefined,
        },
      );
    } catch (error) {
      if (!(error instanceof DataApiError && error.status === 401))
        return { ok: false };
    }
  }
  if (config.sessionCookie) jar.delete(config.sessionCookie);
  jar.delete("orion-demo-key-requests");
  jar.delete("orion-approval-workflow");
  jar.delete("orion-platform-demo");
  await clearDemo();
  return { ok: true };
}
