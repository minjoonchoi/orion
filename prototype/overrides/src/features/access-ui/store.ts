"use client";
import { useMemo, useSyncExternalStore } from "react";
import type { Directory } from "../platforms/model";
import { memberships } from "../identity/fixtures";
export type Binding = { roleId: string; policyId: string; expiresAt: string };
export type Request = {
  id: string;
  userId: string;
  platformId: string;
  roleId: string;
  reason: string;
  expiresAt: string;
  status: "pending" | "cancelled";
  at: string;
};
export type AccessState = {
  directory: Directory;
  bindings: Binding[];
  requests: Request[];
  revision: number;
};
let current: AccessState | undefined;
const listeners = new Set<() => void>();
function init(d: Directory): AccessState {
  return {
    directory: structuredClone(d),
    bindings: d.roles.flatMap((r) =>
      r.policyIds.map((policyId) => ({
        roleId: r.id,
        policyId,
        expiresAt: "",
      })),
    ),
    requests: [],
    revision: 0,
  };
}
export function useAccess(d: Directory) {
  const initial = useMemo(() => init(d), [d]);
  const get = () => (current ??= initial);
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    get,
    () => initial,
  );
}
// Review-only state adapter. API transport and durable writes are not part of this UI proposal.
export function change(expected: number, edit: (next: AccessState) => void) {
  if (!current || current.revision !== expected)
    throw Error("화면이 변경되었습니다. 닫고 다시 검토해 주세요.");
  const next = structuredClone(current);
  edit(next);
  next.revision++;
  next.directory.revision++;
  current = next;
  listeners.forEach((cb) => cb());
}
export const actionCatalog = [
  {
    id: "identity~read-summary",
    platformId: "orion",
    name: "직원 기본 조회",
    domain: "임직원 관리",
    endpoint: "GET /v1/users/{id}",
    policyIds: ["policy-directory"],
    fields: "ID · 이름 · 이메일(마스킹)",
  },
  {
    id: "identity~read-hr",
    platformId: "orion",
    name: "인사 업무 조회",
    domain: "임직원 관리",
    endpoint: "GET /v1/users/{id}",
    policyIds: ["policy-platform"],
    fields: "ID · 이름 · 이메일 · 전화번호(마스킹)",
  },
  {
    id: "review~security",
    platformId: "orion",
    name: "보안 검토",
    domain: "보안",
    endpoint: "GET /v1/security/reviews",
    policyIds: ["policy-security"],
    fields: "검토 ID · 상태 · 담당자",
  },
  {
    id: "settlement~read",
    platformId: "finance",
    name: "정산 조회",
    domain: "정산",
    endpoint: "GET /v1/settlements",
    policyIds: ["policy-settlement"],
    fields: "정산 ID · 금액 · 상태",
  },
];
export function rolePaths(s: AccessState, userId: string) {
  const d = s.directory;
  const orgIds = memberships
    .filter((m) => m.userId === userId)
    .map((m) => m.organizationId);
  return d.roles.flatMap((r) => {
    const paths: {
      id: string;
      role: Directory["roles"][number];
      source: string;
      member: string;
    }[] = [];
    const member =
      d.members.find(
        (m) => m.userId === userId && m.platformId === r.platformId,
      )?.status ?? "none";
    if (
      d.userRoles.some(
        (a) =>
          a.userId === userId &&
          a.platformId === r.platformId &&
          a.roleIds.includes(r.id),
      )
    )
      paths.push({
        id: r.id + "/direct",
        role: r,
        source: "직접 부여",
        member,
      });
    for (const org of d.organizations.filter(
      (o) =>
        o.platformId === r.platformId &&
        orgIds.includes(o.id) &&
        o.roleIds.includes(r.id),
    ))
      paths.push({
        id: r.id + "/" + org.id,
        role: r,
        source: org.name + " 경유",
        member,
      });
    return paths;
  });
}
export function diagnose(s: AccessState, userId: string, actionId: string) {
  const action = actionCatalog.find((a) => a.id === actionId);
  if (!action)
    return {
      allowed: false,
      reason: "대상 Action을 선택해 주세요.",
      paths: [],
    };
  const member = s.directory.members.find(
    (m) => m.platformId === action.platformId && m.userId === userId,
  );
  const paths = rolePaths(s, userId)
    .filter((p) => p.role.platformId === action.platformId)
    .flatMap((p) =>
      s.bindings
        .filter(
          (b) =>
            b.roleId === p.role.id && action.policyIds.includes(b.policyId),
        )
        .map((b) => ({
          ...p,
          binding: b,
          expired:
            !!b.expiresAt &&
            Date.parse(b.expiresAt + "T23:59:59+09:00") < Date.now(),
        })),
    );
  const allowed = member?.status === "active" && paths.some((p) => !p.expired);
  return {
    allowed,
    reason: !member
      ? "플랫폼 멤버십이 없습니다."
      : member.status !== "active"
        ? "플랫폼 멤버십이 중지되어 있습니다."
        : !paths.length
          ? "해당 Action을 허용하는 정책이 없습니다."
          : !paths.some((p) => !p.expired)
            ? "연결된 정책의 부여 기간이 만료되었습니다."
            : "활성 멤버십과 유효한 역할·정책 경로가 있습니다.",
    paths,
  };
}
