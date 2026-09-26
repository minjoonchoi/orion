import english from "./en.json";
export type Locale = "ko" | "en";
const messages: Record<string, string> = english;
export function translate(locale: Locale, message: string): string {
  if (locale === "ko") return message;
  if (messages[message]) return messages[message];
  const units = message.match(/^(\d+)(개|명)$/);
  if (units) return `${units[1]} ${units[2] === "명" ? "people" : "items"}`;
  if (message.startsWith("전체 "))
    return `All ${translate(locale, message.slice(3)).toLowerCase()}`;
  if (message.endsWith(" 상세 정보를 조회합니다."))
    return `View ${translate(locale, message.replace(" 상세 정보를 조회합니다.", "")).toLowerCase()} details.`;
  const removed = message.match(/^(\d+)명의 예제 사용자를 삭제했습니다$/);
  if (removed) return `Deleted ${removed[1]} sample users`;
  const confirm = message.match(
    /^선택한 (\d+)명을 예제 목록에서 제거합니다. 새로고침하면 초기화됩니다.$/,
  );
  if (confirm)
    return `Remove ${confirm[1]} selected sample users. Changes reset on refresh.`;
  const permissions = message.match(
    /^(\d+)개 선택 · 서버에 저장하지 않는 예제입니다.$/,
  );
  if (permissions)
    return `${permissions[1]} selected · This example does not save to the server.`;
  const count = message.match(/^(.*) \((\d+)\)$/);
  if (count) return `${translate(locale, count[1])} (${count[2]})`;
  for (const [suffix, tail] of [
    [" 전체 선택", " select all"],
    [" 작업", " actions"],
    [" 페이지 이동", " pagination"],
    [" 검색", " search"],
    [" 조회", " overview"],
    [" 불러오는 중", " loading"],
    [" 선택", " selection"],
    [" 정렬", " sort"],
    [" 없음", ": none"],
  ] as const) {
    if (message.endsWith(suffix))
      return translate(locale, message.slice(0, -suffix.length)) + tail;
  }
  return message;
}
export function negotiateLocale(
  cookie: string | undefined,
  accept: string | null,
  fallback: Locale,
): Locale {
  if (cookie === "ko" || cookie === "en") return cookie;
  const languages = (accept ?? "")
    .split(",")
    .map((part) => {
      const [language, ...parameters] = part.trim().toLowerCase().split(";");
      const quality = parameters.find((p) => p.trim().startsWith("q="));
      return {
        language: language.split("-")[0],
        q: quality ? Number(quality.trim().slice(2)) : 1,
      };
    })
    .filter((v) => v.q > 0 && v.q <= 1)
    .sort((a, b) => b.q - a.q);
  return (
    (languages.find((v) => v.language === "ko" || v.language === "en")
      ?.language as Locale | undefined) ?? fallback
  );
}
