"use client";
import { createContext, useContext, type ReactNode } from "react";
import { translate, type Locale } from "./core";
const Context = createContext({
  locale: "ko" as Locale,
  timeZone: "Asia/Seoul",
  mode: "demo",
  environment: "development",
  region: "local",
});
export function I18nProvider({
  children,
  ...settings
}: {
  children: ReactNode;
  locale: Locale;
  timeZone: string;
  mode: string;
  environment: string;
  region: string;
}) {
  return <Context.Provider value={settings}>{children}</Context.Provider>;
}
export function useI18n() {
  const context = useContext(Context);
  return {
    ...context,
    t: (message: string) => translate(context.locale, message),
  };
}
export function LanguageSelect() {
  const { locale } = useI18n();
  return (
    <select
      className="language-select"
      aria-label="Language / 언어"
      value={locale}
      onChange={(event) => {
        document.cookie = `orion-locale=${event.target.value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
        location.reload();
      }}
    >
      <option value="ko">한국어</option>
      <option value="en">English</option>
    </select>
  );
}
export function DeploymentLabel() {
  const { environment, region } = useI18n();
  return (
    <span className="badge">
      {environment} · {region}
    </span>
  );
}
export function DateValue({
  value,
  time = false,
  empty = "기록 없음",
}: {
  value: string | null;
  time?: boolean;
  empty?: string;
}) {
  const { locale, timeZone, t } = useI18n();
  return value ? (
    <time dateTime={value}>
      {new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        ...(time
          ? { hour: "2-digit" as const, minute: "2-digit" as const }
          : {}),
      }).format(new Date(value))}
    </time>
  ) : (
    <>{t(empty)}</>
  );
}
