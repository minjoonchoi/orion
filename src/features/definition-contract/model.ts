import { parseAllDocuments, stringify } from "yaml";
export type Data = Record<string, unknown>;
export type Definition = {
  key: string;
  kind: string;
  id: string;
  parent: string;
  name: string;
  file: string;
  data: Data;
  refs: string[];
};
export const obj = (v: unknown): Data =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Data) : {};
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const entries = (v: unknown) => Object.entries(obj(v));
export const rules = (v: unknown): [string, Data][] =>
  arr(v).map((x) =>
    typeof x === "string"
      ? [x, {}]
      : [Object.keys(obj(x))[0] ?? "", obj(Object.values(obj(x))[0])],
  );
export const yaml = (v: unknown) => stringify(v);
export function parseFiles(files: Record<string, string>): Definition[] {
  const result: Definition[] = [];
  function add(
    kind: string,
    id: string,
    parent: string,
    file: string,
    data: Data,
    refs: string[] = [],
  ) {
    const key = `${kind}/${parent ? parent + "/" : ""}${id}`;
    if (result.some((x) => x.key === key)) throw Error(`중복 정의: ${key}`);
    result.push({
      key,
      kind,
      id,
      parent,
      file,
      name: String(data.name ?? data.description ?? id),
      data,
      refs,
    });
  }
  for (const [file, text] of Object.entries(files))
    for (const document of parseAllDocuments(text)) {
      if (document.errors.length)
        throw Error(`${file}: ${document.errors[0].message}`);
      const d = obj(document.toJS());
      for (const [id, raw] of entries(d.platforms))
        add("platform", id, "", file, obj(raw));
      for (const [id, raw] of entries(d.policies)) {
        const p = obj(raw),
          refs: string[] = [];
        for (const action of arr(p.actions))
          refs.push(`action/${String(action).replace(".", "/")}`);
        for (const [workspace, value] of entries(p.workspaces)) {
          const parent = workspace.replace(".", "/");
          refs.push(`workspace/${parent}`);
          for (const [page, config] of entries(obj(value).pages)) {
            refs.push(`page/${parent}/${page}`);
            for (const action of arr(obj(config).actions))
              refs.push(`action/${String(action).replace(".", "/")}`);
          }
        }
        add("policy", id, "", file, p, [...new Set(refs)]);
      }
      if (d.organization) {
        const o = obj(d.organization);
        add(
          "organization",
          String(o.id),
          "",
          file,
          o,
          o.parent ? [`organization/${o.parent}`] : [],
        );
      }
      if (d["masking-rules"])
        for (const [id, data] of entries(d["masking-rules"]))
          add("masking", id, "", file, obj(data));
      if (d.service && typeof d.service === "object") {
        const s = obj(d.service);
        add("service", String(s.id), "", file, s, [
          `organization/${s.organization}`,
        ]);
      }
      if (typeof d.service === "string")
        for (const raw of arr(d.endpoints)) {
          const e = obj(raw);
          const masks = ["request", "response"].flatMap((p) =>
            entries(obj(e[p]).fields).flatMap(([, f]) =>
              obj(f).privacy ? [`masking/${obj(f).masking ?? "redact"}`] : [],
            ),
          );
          add("endpoint", String(e.id), d.service, file, e, [
            `service/${d.service}`,
            ...new Set(masks),
          ]);
        }
      if (d.domain) {
        const domain = obj(d.domain),
          id = String(domain.id);
        add("domain", id, "", file, { id, name: domain.name });
        for (const [sid, s] of entries(domain.scopes))
          add("scope", sid, id, file, obj(s), [
            `domain/${id}`,
            ...arr(obj(s).organizations).map(
              (o) => `organization/${obj(o).organization}`,
            ),
          ]);
        for (const [aid, a] of entries(domain.actions)) {
          const endpoint = obj(obj(a).endpoint);
          add("action", aid, id, file, obj(a), [
            `domain/${id}`,
            `endpoint/${endpoint.service}/${endpoint.endpoint}`,
            ...rules(obj(endpoint.request).fields)
              .filter(([, r]) => r.scope)
              .map(([, r]) => `scope/${id}/${r.scope}`),
          ]);
        }
        for (const [pid, p] of entries(domain.policies))
          add("policy", pid, id, file, obj(p), [
            `domain/${id}`,
            ...arr(obj(p).actions).map((a) => `action/${id}/${a}`),
          ]);
      }
      if (d.workspace) {
        const w = obj(d.workspace),
          parent = String(w.platform),
          id = String(w.id);
        const { pages, ...data } = w;
        add("workspace", id, parent, file, data, [`platform/${parent}`]);
        for (const raw of arr(pages)) {
          const p = obj(raw);
          add("page", String(p.id), `${parent}/${id}`, file, p, [
            `workspace/${parent}/${id}`,
            ...arr(p.actions).map(
              (a) => `action/${obj(a).domain}/${obj(a).action}`,
            ),
          ]);
        }
      }
    }
  return result;
}
export function validate(defs: Definition[]): string[] {
  const errors: string[] = [];
  const find = (k: string) => defs.find((d) => d.key === k);
  for (const d of defs) {
    for (const r of d.refs)
      if (!find(r)) errors.push(`${d.key}: 참조 없음 ${r}`);
    if (d.kind === "policy" && !d.parent) {
      if (!["role", "service_account"].includes(String(d.data.assignable_to)))
        errors.push(`${d.key}: 부여 대상 오류`);
      if (
        d.data.assignable_to === "service_account" &&
        Object.keys(obj(d.data.workspaces)).length
      )
        errors.push(`${d.key}: 서비스 어카운트 정책에 화면 조건 사용 불가`);
      if (
        !arr(d.data.actions).length &&
        !Object.keys(obj(d.data.workspaces)).length
      )
        errors.push(`${d.key}: 권한 대상 없음`);
      for (const [workspace, value] of entries(d.data.workspaces)) {
        if (!Object.keys(obj(obj(value).pages)).length)
          errors.push(`${d.key}: 페이지를 지정하세요`);
        for (const [page, config] of entries(obj(value).pages)) {
          if (!arr(obj(config).actions).length)
            errors.push(`${d.key}: 페이지의 액션을 지정하세요`);
          const def = find(`page/${workspace.replace(".", "/")}/${page}`);
          for (const action of arr(obj(config).actions))
            if (
              def &&
              !def.refs.includes(`action/${String(action).replace(".", "/")}`)
            )
              errors.push(`${d.key}: 페이지 미등록 액션 ${action}`);
        }
      }
    }
    if (d.kind === "organization") {
      const visited = new Set<string>();
      let current: Definition | undefined = d;
      while (current) {
        if (visited.has(current.key)) {
          errors.push(`${d.key}: 조직 계층 순환`);
          break;
        }
        visited.add(current.key);
        current = current.data.parent
          ? find(`organization/${current.data.parent}`)
          : undefined;
      }
    }
    if (d.kind === "scope") {
      const codes = arr(d.data.codes).map((x) => obj(x).code);
      if (new Set(codes).size !== codes.length)
        errors.push(`${d.key}: 중복 코드`);
      for (const o of arr(d.data.organizations))
        for (const c of arr(obj(o).codes))
          if (!codes.includes(c)) errors.push(`${d.key}: 코드 없음 ${c}`);
    }
    if (
      d.kind === "policy" &&
      !["allow", "deny"].includes(String(d.data.effect))
    )
      errors.push(`${d.key}: 잘못된 effect`);
    if (d.kind === "masking") {
      const r = d.data,
        method = String(r.method);
      if (!["email", "partial", "redact"].includes(method))
        errors.push(`${d.key}: 지원하지 않는 마스킹 방식`);
      const options = method === "email" ? obj(r["local-part"]) : r;
      if (method !== "redact") {
        for (const k of ["keep-start", "keep-end"])
          if (
            !Number.isInteger(options[k]) ||
            Number(options[k]) < 0 ||
            Number(options[k]) > 100
          )
            errors.push(`${d.key}: 잘못된 마스킹 옵션 ${k}`);
        if (
          !Number.isInteger(r["replacement-length"]) ||
          Number(r["replacement-length"]) < 1 ||
          Number(r["replacement-length"]) > 100
        )
          errors.push(`${d.key}: 잘못된 마스킹 길이`);
        if (r["on-short"] !== "redact")
          errors.push(`${d.key}: 짧은 값 보호 필요`);
        if (
          method === "email" &&
          (r["on-invalid"] !== "redact" || r.domain !== "preserve")
        )
          errors.push(`${d.key}: 이메일 보호 설정 오류`);
      }
      if (typeof r.replacement !== "string" || !r.replacement)
        errors.push(`${d.key}: 대체 문자열 필요`);
    }
    if (d.kind === "endpoint")
      for (const phase of ["request", "response"]) {
        const positions = new Set<string>();
        for (const [field, value] of entries(obj(d.data[phase]).fields)) {
          const f = obj(value),
            location = String(f.location ?? "body");
          const position =
            location +
            ":" +
            (location === "header"
              ? String(f.path).toLowerCase()
              : String(f.path));
          if (positions.has(position))
            errors.push(`${d.key}: 중복 필드 위치 ${field}`);
          positions.add(position);
          if (typeof f.privacy !== "boolean")
            errors.push(`${d.key}: privacy 명시 필요 ${field}`);
          if (
            ![
              "string",
              "number",
              "integer",
              "boolean",
              "object",
              "array",
            ].includes(String(f.type))
          )
            errors.push(`${d.key}: 필드 타입 오류 ${field}`);
          if (
            phase === "request" &&
            !["query", "path", "header", "body"].includes(location)
          )
            errors.push(`${d.key}: 요청 위치 오류 ${field}`);
          if (!f.privacy && f.masking)
            errors.push(`${d.key}: 일반 필드 마스킹 설정 ${field}`);
          if (f.privacy) {
            const rule = find(`masking/${f.masking ?? "redact"}`);
            if (rule && rule.data.method !== "redact" && f.type !== "string")
              errors.push(`${d.key}: 마스킹 타입 불일치 ${field}`);
          }
        }
      }
    if (d.kind !== "action") continue;
    const endpoint = obj(d.data.endpoint),
      original = find(`endpoint/${endpoint.service}/${endpoint.endpoint}`);
    for (const phase of ["request", "response"]) {
      const raw = obj(endpoint[phase]).fields;
      if (!Array.isArray(raw)) {
        errors.push(`${d.key}: ${phase}.fields 명시 필요`);
        continue;
      }
      for (const item of raw)
        if (typeof item !== "string" && Object.keys(obj(item)).length !== 1)
          errors.push(`${d.key}: 필드 항목에는 하나의 키만 허용`);
      const parsed = rules(raw),
        names = parsed.map(([f]) => f);
      if (new Set(names).size !== names.length)
        errors.push(`${d.key}: 중복 ${phase} 필드`);
      const fs = obj(obj(original?.data[phase]).fields);
      for (const [field, r] of parsed) {
        if (!fs[field]) errors.push(`${d.key}: ${phase} 필드 없음 ${field}`);
        if (
          r.source &&
          !["subject.email", "subject.nickname"].includes(String(r.source))
        )
          errors.push(`${d.key}: 지원하지 않는 source ${r.source}`);
        if (r.source && r.scope) errors.push(`${d.key}: source/scope 중복`);
        if (
          r.scope &&
          (obj(fs[field]).type !== "array" ||
            obj(obj(fs[field]).items).type !== "string")
        )
          errors.push(`${d.key}: scope 필드는 문자열 배열 필요`);
        if (r.source && obj(fs[field]).type !== "string")
          errors.push(`${d.key}: source 필드는 문자열 필요`);
        const allowed = phase === "request" ? ["source", "scope"] : ["unmask"];
        if (Object.keys(r).some((k) => !allowed.includes(k)))
          errors.push(`${d.key}: 허용하지 않는 필드 옵션`);
        if (r.unmask !== undefined && typeof r.unmask !== "boolean")
          errors.push(`${d.key}: unmask는 boolean`);
      }
      if (phase === "request")
        for (const [field, v] of entries(fs))
          if (obj(v).required && !names.includes(field))
            errors.push(`${d.key}: 필수 요청 누락 ${field}`);
    }
  }
  return [...new Set(errors)];
}
export const changed = (a: Definition | undefined, b: Definition | undefined) =>
  JSON.stringify(a?.data) !== JSON.stringify(b?.data);
export function makePlan(
  applied: Definition[],
  desired: Definition[],
  selected: string[],
) {
  const included = new Set<string>();
  function visit(k: string) {
    if (included.has(k)) return;
    included.add(k);
    desired.find((d) => d.key === k)?.refs.forEach(visit);
  }
  selected.forEach(visit);
  const next = applied.map((d) =>
    included.has(d.key) ? (desired.find((n) => n.key === d.key) ?? d) : d,
  );
  for (const d of desired)
    if (included.has(d.key) && !next.some((n) => n.key === d.key)) next.push(d);
  return {
    keys: [...included],
    next,
    changes: next.filter((d) =>
      changed(
        applied.find((a) => a.key === d.key),
        d,
      ),
    ),
    errors: validate(next),
  };
}
export function affected(defs: Definition[], keys: string[]) {
  const found = new Set(keys);
  let size = -1;
  while (size !== found.size) {
    size = found.size;
    for (const d of defs)
      if (d.refs.some((r) => found.has(r))) found.add(d.key);
  }
  return defs.filter((d) => found.has(d.key) && !keys.includes(d.key));
}
export function mask(
  value: string,
  rule: Data,
  fallback = "[REDACTED]",
): string {
  if (rule.method === "redact") return String(rule.replacement ?? fallback);
  let local = value,
    domain = "";
  if (rule.method === "email") {
    const parts = value.split("@");
    if (parts.length !== 2 || !parts[0] || !parts[1] || /\s/.test(value))
      return fallback;
    [local, domain] = parts;
  }
  if (!["email", "partial"].includes(String(rule.method))) return fallback;
  const opts = rule.method === "email" ? obj(rule["local-part"]) : rule;
  const start = Number(opts["keep-start"] ?? 0),
    end = Number(opts["keep-end"] ?? 0),
    count = Number(rule["replacement-length"] ?? 3);
  if (
    ![start, end, count].every(
      (x) => Number.isInteger(x) && x >= 0 && x <= 100,
    ) ||
    count === 0
  )
    return fallback;
  const chars = Array.from(
    new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(local),
    (x) => x.segment,
  );
  if (chars.length <= start + end) return fallback;
  return (
    chars.slice(0, start).join("") +
    String(rule.replacement ?? "*").repeat(count) +
    (end ? chars.slice(-end).join("") : "") +
    (domain ? "@" + domain : "")
  );
}
