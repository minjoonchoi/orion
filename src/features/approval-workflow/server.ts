import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { deployment } from "@/lib/api/server";
import { DataApiError, requestData } from "@/lib/api/transport";
import { getLocale } from "@/i18n/server";
import { stateSchema, publicState, type State } from "./model";
export async function rawState(): Promise<State> {
  const config = deployment(),
    jar = await cookies();
  if (config.mode === "api") {
    try {
      return await requestData(config, "approval-workflow", stateSchema, {
        locale: await getLocale(),
        session: config.sessionCookie
          ? jar.get(config.sessionCookie)?.value
          : undefined,
      });
    } catch (e) {
      if (e instanceof DataApiError && e.status === 403) redirect("/forbidden");
      if (e instanceof DataApiError && e.status === 401) redirect("/login");
      throw e;
    }
  }
  const { sessions, seed } = await import("./demo");
  const stored = sessions.get(jar.get("orion-approval-workflow")?.value ?? "");
  return stored && Date.now() - stored.at < 86400000
    ? structuredClone(stored.state)
    : seed();
}
export async function loadWorkflow() {
  return publicState(await rawState());
}
