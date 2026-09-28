import { arr, entries, obj, rules, type Definition } from "./model";
export type Grant = {
  id: string;
  action: string;
  workspace: string;
  page: string;
  effect: string;
  policy: string;
};
export type Binding = { policy: string; expiresAt: string | null };
export type Subject = {
  id: string;
  name: string;
  kind: "role" | "service_account";
  platform: string;
  email?: string;
  organization?: string;
};
export const subjects: Subject[] = [
  {
    id: "role-sales-reader",
    name: "영업 담당자",
    kind: "role",
    platform: "sales-platform",
  },
  {
    id: "role-sales-manager",
    name: "영업 관리자",
    kind: "role",
    platform: "sales-platform",
  },
  {
    id: "sa-platform-ci",
    name: "Platform CI",
    kind: "service_account",
    platform: "",
    organization: "org-platform",
  },
];
export const initialBindings: Record<string, Binding[]> = {
  "role-sales-reader": [{ policy: "regional-reader", expiresAt: null }],
  "role-sales-manager": [
    { policy: "regional-reader", expiresAt: null },
    { policy: "regional-reader-backup", expiresAt: null },
    { policy: "regional-contact-reader", expiresAt: null },
  ],
  "sa-platform-ci": [{ policy: "service-employee-reader", expiresAt: null }],
};
export function grants(policy: Definition): Grant[] {
  const rows: Grant[] = [];
  function add(action: string, workspace = "", page = "") {
    rows.push({
      id: `${workspace}/${page}/${action}`,
      action,
      workspace,
      page,
      effect: String(policy.data.effect),
      policy: policy.id,
    });
  }
  arr(policy.data.actions).forEach((a) => add(String(a)));
  for (const [w, value] of entries(policy.data.workspaces))
    for (const [p, config] of entries(obj(value).pages))
      arr(obj(config).actions).forEach((a) => add(String(a), w, p));
  return rows;
}
export function compatible(policy: Definition, subject: Subject) {
  return (
    policy.data.assignable_to === subject.kind &&
    (subject.kind === "service_account" ||
      Object.keys(obj(policy.data.workspaces)).every((w) =>
        w.startsWith(subject.platform + "."),
      ))
  );
}
export function effective(
  defs: Definition[],
  bindings: Binding[],
  subject: Subject,
  now = Date.now(),
) {
  const policies = defs.filter(
    (d) =>
      d.kind === "policy" &&
      compatible(d, subject) &&
      bindings.some(
        (b) =>
          b.policy === d.id && (!b.expiresAt || Date.parse(b.expiresAt) > now),
      ),
  );
  const all = policies.flatMap(grants);
  const allowed = all.filter(
    (g) =>
      g.effect === "allow" &&
      !all.some(
        (d) =>
          d.effect === "deny" &&
          d.action === g.action &&
          (!d.workspace || (d.workspace === g.workspace && d.page === g.page)),
      ),
  );
  return [...new Map(allowed.map((g) => [g.id, g])).values()];
}
export function requirements(
  defs: Definition[],
  action: string,
  subject: Subject,
) {
  const a = defs.find((d) => d.key === `action/${action.replace(".", "/")}`);
  if (!a) return ["액션 정의 없음"];
  const issues: string[] = [];
  for (const [, r] of rules(obj(obj(a.data.endpoint).request).fields)) {
    if (r.source && subject.kind === "service_account" && !subject.email)
      issues.push(`필수 속성 확인 필요: ${String(r.source)}`);
    if (r.scope && subject.kind === "service_account") {
      const s = defs.find(
        (d) => d.key === `scope/${a.parent}/${String(r.scope)}`,
      );
      if (
        !arr(s?.data.organizations).some(
          (o) =>
            obj(o).organization === subject.organization &&
            arr(obj(o).codes).length,
        )
      )
        issues.push("사용 가능한 scope 코드 없음");
    }
  }
  return [...new Set(issues)];
}
export function policyBindingsFor(
  defs: Definition[],
  ids: string[],
  old: Binding[],
) {
  return ids
    .filter((id) => defs.some((d) => d.kind === "policy" && d.id === id))
    .map(
      (policy) =>
        old.find((b) => b.policy === policy) ?? { policy, expiresAt: null },
    );
}
