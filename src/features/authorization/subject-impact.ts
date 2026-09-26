import type { Graph, ResourceRef } from "./model.ts";

export type ImpactScope = {
  resources?: ResourceRef[];
  policyIds?: string[];
  roleIds?: string[];
};
export type SubjectKind = "users" | "organizations" | "service-accounts";
type Named = { id: string; name: string };
export type SubjectPath = {
  key: string;
  role: Named;
  policy: Named & { effect: "allow" | "deny" };
  resources: ResourceRef[];
  expiresAt: string | null;
  expired: boolean;
  change?: "added" | "removed";
};
export type ImpactSubject = Named & {
  kind: SubjectKind;
  organizationId?: string;
  paths: SubjectPath[];
};
const refKey = (r: ResourceRef) => `${r.kind}:${r.id}`;
const subjectKey = (s: ImpactSubject) => `${s.kind}:${s.id}`;

export function subjectImpact(
  graph: Graph,
  scope: ImpactScope,
  includeExpired = false,
  now = Date.now(),
): ImpactSubject[] {
  const result = new Map<string, ImpactSubject>();
  function add(
    kind: SubjectKind,
    subject: Named & { organizationId?: string },
    path: SubjectPath,
  ) {
    const key = `${kind}:${subject.id}`;
    if (!result.has(key)) result.set(key, { ...subject, kind, paths: [] });
    const row = result.get(key)!;
    if (!row.paths.some((p) => p.key === path.key)) row.paths.push(path);
  }
  for (const role of graph.roles) {
    if (scope.roleIds && !scope.roleIds.includes(role.id)) continue;
    for (const binding of role.bindings) {
      if (scope.policyIds && !scope.policyIds.includes(binding.policyId))
        continue;
      const policy = graph.policies.find((p) => p.id === binding.policyId);
      if (!policy) continue;
      const resources = [
        ...new Map(
          policy.resources
            .filter(
              (r) =>
                !scope.resources ||
                scope.resources.some((s) => refKey(s) === refKey(r)),
            )
            .map((r) => [
              refKey(r),
              {
                ...r,
                name:
                  graph.resources.find((s) => refKey(s) === refKey(r))?.name ??
                  r.id,
              },
            ]),
        ).values(),
      ];
      if (scope.resources && !resources.length) continue;
      const expired = Boolean(
        binding.expiresAt && Date.parse(binding.expiresAt) <= now,
      );
      if (expired && !includeExpired) continue;
      const base: SubjectPath = {
        key: `${role.id}:${policy.id}:direct`,
        role: { id: role.id, name: role.name },
        policy: { id: policy.id, name: policy.name, effect: policy.effect },
        resources,
        expiresAt: binding.expiresAt,
        expired,
      };
      graph.users
        .filter((u) => role.userIds.includes(u.id))
        .forEach((u) => add("users", u, base));
      for (const org of graph.organizations.filter((o) =>
        role.organizationIds.includes(o.id),
      )) {
        add("organizations", org, base);
      }
      // Ownership is metadata. Only explicit service-account role grants confer a path.
      graph.serviceAccounts
        ?.filter((a) => a.roleIds.includes(role.id))
        .forEach((a) => add("service-accounts", a, base));
    }
  }
  return [...result.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}
function signature(path: SubjectPath) {
  return JSON.stringify([
    path.key,
    path.policy.effect,
    path.expiresAt,
    path.resources.map(refKey).sort(),
  ]);
}
export function compareSubjectImpact(
  before: Graph,
  after: Graph,
  scope: ImpactScope,
  includeExpired = false,
  now = Date.now(),
): ImpactSubject[] {
  const previous = subjectImpact(before, scope, includeExpired, now);
  const next = subjectImpact(after, scope, includeExpired, now);
  const subjects = new Map(
    [...previous, ...next].map((s) => [subjectKey(s), s]),
  );
  return [...subjects.values()].flatMap((subject) => {
    const oldPaths =
      previous.find((s) => subjectKey(s) === subjectKey(subject))?.paths ?? [];
    const newPaths =
      next.find((s) => subjectKey(s) === subjectKey(subject))?.paths ?? [];
    const paths: SubjectPath[] = [
      ...oldPaths
        .filter((p) => !newPaths.some((n) => signature(n) === signature(p)))
        .map((p) => ({ ...p, change: "removed" as const })),
      ...newPaths
        .filter((p) => !oldPaths.some((n) => signature(n) === signature(p)))
        .map((p) => ({ ...p, change: "added" as const })),
    ];
    return paths.length ? [{ ...subject, paths }] : [];
  });
}
