import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { deployment } from "@/lib/api/server";
import { requestData, DataApiError } from "@/lib/api/transport";
import { getLocale } from "@/i18n/server";
import { object } from "@/lib/api/schema";
import { validateDirectory } from "./model";
export async function loadDirectory() {
  const config = deployment(),
    jar = await cookies();
  if (config.mode === "demo") {
    const { directories, demoDirectory } = await import("./demo");
    return validateDirectory(
      directories.get(jar.get("orion-platform-demo")?.value ?? "") ??
        demoDirectory(),
    );
  }
  try {
    return (
      await requestData(
        config,
        "platform-directory",
        object({ data: { parse: validateDirectory } }),
        {
          locale: await getLocale(),
          session: config.sessionCookie
            ? jar.get(config.sessionCookie)?.value
            : undefined,
        },
      )
    ).data;
  } catch (e) {
    if (e instanceof DataApiError && e.status === 403) redirect("/forbidden");
    if (e instanceof DataApiError && e.status === 401) redirect("/login");
    throw e;
  }
}
