import "server-only";
import { cookies, headers } from "next/headers";
import { negotiateLocale, translate } from "./core";
export async function getLocale() {
  return negotiateLocale(
    (await cookies()).get("orion-locale")?.value,
    (await headers()).get("accept-language"),
    process.env.ORION_DEFAULT_LOCALE === "en" ? "en" : "ko",
  );
}
export async function getT() {
  const locale = await getLocale();
  return (message: string) => translate(locale, message);
}
