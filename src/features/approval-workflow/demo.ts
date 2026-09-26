import {
  users,
  organizations,
  memberships,
  services,
  serviceAccounts,
  organizationServices,
  organizationLeaders,
} from "../identity/fixtures.ts";
import { endpoints } from "../resources/fixtures.ts";
import { apply, type State, type Template } from "./model.ts";
const fields: Template["fields"] = [
  ["accountId", "서비스 어카운트"],
  ["serviceId", "관리 서비스"],
  ["endpointIds", "엔드포인트"],
  ["secretName", "Secret name"],
  ["secretKey", "Secret value key"],
  ["reason", "요청 사유"],
].map(([key, label]) => ({ key, label, required: "yes" }));
export function seed(): State {
  let s: State = {
    revision: 1,
    actorId: "usr-001",
    templateAdminIds: ["usr-001"],
    users: users.map(({ id, name }) => ({ id, name })),
    organizations: organizations.map(({ id, name }) => ({ id, name })),
    memberships: memberships.map(({ userId, organizationId }) => ({
      userId,
      organizationId,
    })),
    leaders: users.map((u) => ({
      userId: u.id,
      leaderId:
        organizationLeaders[
          memberships.find((m) => m.userId === u.id)?.organizationId ?? ""
        ] ?? "usr-002",
    })),
    accounts: serviceAccounts.map(({ id, name }) => ({ id, name })),
    services: services.map((v) => ({
      id: v.id,
      name: v.name,
      teamId:
        Object.entries(organizationServices).find(([, ids]) =>
          ids.includes(v.id),
        )?.[0] ?? "org-platform",
    })),
    endpoints,
    templates: (["issue", "replace", "revoke"] as const).map((type) => ({
      id: `api-key-${type}`,
      name: `API 키 ${type === "issue" ? "발급" : type === "replace" ? "교체" : "폐기"}`,
      type,
      version: 1,
      fields: structuredClone(fields),
      line: [
        {
          label: "요청자 팀장 승인",
          action: "approve",
          kind: "requester-leader",
          id: "",
        },
        ...(type === "issue"
          ? [
              {
                label: "보안팀 합의",
                action: "agree" as const,
                kind: "organization" as const,
                id: "org-security",
              },
            ]
          : []),
        {
          label: "관리서비스 팀 합의",
          action: "agree",
          kind: "service-team",
          id: "",
        },
      ],
    })),
    documents: [],
    keys: [],
    policies: [],
    roles: [],
  };
  // Demo actors are real catalog entries. No production identity is inferred here.
  s.leaders = s.leaders.map((l) =>
    l.userId === "usr-001" ? { ...l, leaderId: "usr-002" } : l,
  );
  if (
    !s.memberships.some(
      (m) => m.userId === "usr-003" && m.organizationId === "org-security",
    )
  )
    s.memberships.push({ userId: "usr-003", organizationId: "org-security" });
  if (
    !s.memberships.some(
      (m) => m.userId === "usr-001" && m.organizationId === "org-platform",
    )
  )
    s.memberships.push({ userId: "usr-001", organizationId: "org-platform" });
  s.services = s.services.map((v) =>
    v.id === "svc-directory" ? { ...v, teamId: "org-platform" } : v,
  );
  s = apply(
    s,
    {
      kind: "request",
      templateId: "api-key-issue",
      keyId: "",
      requestId: "approval-demo-001",
      input: {
        accountId: "sa-directory-sync",
        serviceId: "svc-directory",
        endpointIds: ["ep-users", "ep-orgs"],
        secretName: "orion/directory/integration",
        secretKey: "apiKey",
        reason: "인사 디렉터리의 사용자와 조직 정보를 동기화합니다.",
      },
    },
    s.revision,
    "2026-09-26T08:00:00Z",
  );
  return s;
}
const root = globalThis as typeof globalThis & {
  orionApprovalSessions?: Map<string, { state: State; at: number }>;
};
export const sessions = (root.orionApprovalSessions ??= new Map());
