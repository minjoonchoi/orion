"use client";
import { useI18n } from "@/i18n/provider";
import { Badge } from "@/components/ui/badge";
import { obj, rules, entries, mask, type Definition, type Data } from "./model";
import { useContract } from "./state";
function sample(name: string, field: Data): unknown {
  if (field.type === "array") return ["EXAMPLE"];
  if (field.type === "number" || field.type === "integer") return 0;
  if (field.type === "boolean") return false;
  if (field.type === "object") return {};
  if (name.includes("email")) return "employee@example.test";
  if (name.includes("name")) return "김가람";
  return "EXAMPLE";
}
function place(root: Data, path: string, value: unknown) {
  const parts = path
    .replace(/^\//, "")
    .split("/")
    .map((p) => p.replaceAll("~1", "/").replaceAll("~0", "~"));
  if (parts.some((p) => ["__proto__", "prototype", "constructor"].includes(p)))
    return;
  let current: Data | unknown[] = root;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i] === "*" ? "0" : parts[i];
    const target = current as Data;
    if (i === parts.length - 1) target[key] = value;
    else {
      if (!target[key]) target[key] = parts[i + 1] === "*" ? [] : {};
      current = target[key] as Data;
    }
  }
}
export function ActionContractComparison({
  action,
  endpoint,
  phase,
}: {
  action: Definition;
  endpoint: Definition;
  phase: "request" | "response";
}) {
  const { t } = useI18n();
  const { applied } = useContract();
  const fields = entries(obj(endpoint.data[phase]).fields),
    selected = new Map(rules(obj(obj(action.data.endpoint)[phase]).fields));
  const original: Data = {},
    transformed: Data = {};
  const rows = fields.map(([name, raw]) => {
    const field = obj(raw),
      rule = selected.get(name),
      included = selected.has(name);
    const base = sample(name, field);
    let value = base;
    let operation = "그대로 반환";
    if (!included) operation = "제외";
    else if (phase === "request") {
      operation = rule?.scope
        ? "조회 범위 주입"
        : rule?.source
          ? "호출자 정보 주입"
          : "입력 검증 후 전달";
      if (rule?.scope) value = [`<scope:${String(rule.scope)}>`];
      else if (rule?.source) value = `<${String(rule.source)}>`;
    } else if (field.privacy) {
      operation = rule?.unmask ? "원문 반환" : "마스킹";
      if (!rule?.unmask)
        value = mask(
          String(base),
          applied.find((d) => d.key === `masking/${field.masking ?? "redact"}`)
            ?.data ?? { method: "redact", replacement: "[REDACTED]" },
        );
    }
    const location =
      phase === "request" ? String(field.location ?? "body") : "";
    function target(root: Data) {
      if (!location) return root;
      return (root[location] ??= {}) as Data;
    }
    place(target(original), String(field.path ?? name), base);
    if (included) place(target(transformed), String(field.path ?? name), value);
    return { name, field, rule, included, operation };
  });
  return (
    <section className="ui-panel ui-layout-stack" data-contract-phase={phase}>
      <div>
        <h2>{t(phase === "request" ? "요청 비교" : "응답 비교")}</h2>
        <p className="contract-muted">
          {t(
            phase === "request"
              ? "엔드포인트 입력 명세와 Gateway가 구성할 요청을 비교합니다."
              : "엔드포인트 응답 명세와 호출자에게 반환할 결과를 비교합니다.",
          )}
        </p>
      </div>
      <div className="contract-table">
        <table>
          <thead>
            <tr>
              {[
                "필드 / 위치",
                "엔드포인트 정의",
                "액션 적용 후",
                "적용 근거",
                "로그",
              ].map((h) => (
                <th key={h}>{t(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td>
                  <strong>{r.name}</strong>
                  <small>
                    {String(r.field.location ?? "body")} ·{" "}
                    {String(r.field.path ?? r.name)}
                  </small>
                </td>
                <td>
                  {String(r.field.type)}
                  <small>
                    {t(r.field.required ? "필수" : "선택")}
                    {r.field.privacy ? ` · ${t("개인정보")}` : ""}
                  </small>
                </td>
                <td>
                  <Badge
                    tone={
                      !r.included
                        ? "neutral"
                        : r.operation === "원문 반환"
                          ? "warning"
                          : "info"
                    }
                  >
                    {t(r.operation)}
                  </Badge>
                </td>
                <td>
                  {r.rule?.scope
                    ? `scope: ${r.rule.scope}`
                    : r.rule?.source
                      ? String(r.rule.source)
                      : !r.included
                        ? t("액션 허용 목록에 없음")
                        : r.rule?.unmask
                          ? "unmask: true"
                          : r.field.privacy
                            ? `masking: ${r.field.masking ?? "redact"}`
                            : t("액션에 명시됨")}
                </td>
                <td>
                  {r.field.privacy
                    ? `${t("마스킹")} · ${r.field.masking ?? "redact"}`
                    : t("일반 필드")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        {t(
          "정의 기반 형태 예시입니다. 실제 호출 결과가 아니며 주입 값은 실행 시 서버에서 결정합니다.",
        )}
      </p>
      <div className="contract-diff">
        <section className="ui-layout-stack">
          <h3>{t("엔드포인트 원본 형태")}</h3>
          <pre className="policy-code">{JSON.stringify(original, null, 2)}</pre>
        </section>
        <section className="ui-layout-stack">
          <h3>{t("액션 적용 후 형태")}</h3>
          <pre className="policy-code">
            {JSON.stringify(transformed, null, 2)}
          </pre>
        </section>
      </div>
      <p className="contract-muted">
        {t(
          "개인정보 원문 반환을 허용해도 로그 마스킹은 유지됩니다. 정의에 없는 필드는 전달하거나 반환하지 않습니다.",
        )}
      </p>
    </section>
  );
}
