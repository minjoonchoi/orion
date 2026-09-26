import { users, organizations, serviceAccounts } from "../identity/fixtures";
import { serviceAccountRoles } from "../service-accounts/fixtures";
import type { Directory } from "./model";
export function demoDirectory(): Directory {
  return {
    revision: 0,
    platforms: [
      {
        id: "orion",
        name: "Orion",
        description: "인증·인가 관리 플랫폼",
        status: "active",
        provider: "Okta OIDC",
        issuer: "https://example.okta.com/oauth2/default",
        clientId: "orion-console",
        loginPath: "/auth/platforms/orion/login",
      },
      {
        id: "finance",
        name: "Finance",
        description: "정산·재무 업무 플랫폼",
        status: "active",
        provider: "Okta OIDC",
        issuer: "https://example.okta.com/oauth2/default",
        clientId: "finance-console",
        loginPath: "/auth/platforms/finance/login",
      },
    ],
    members: [
      {
        id: "member-001",
        platformId: "orion",
        userId: users[0].id,
        name: users[0].name,
        email: users[0].email,
        status: "active",
      },
      {
        id: "member-002",
        platformId: "orion",
        userId: users[1].id,
        name: users[1].name,
        email: users[1].email,
        status: "active",
      },
      {
        id: "member-003",
        platformId: "orion",
        userId: users[5].id,
        name: users[5].name,
        email: users[5].email,
        status: "suspended",
      },
      {
        id: "member-001",
        platformId: "finance",
        userId: users[0].id,
        name: users[0].name,
        email: users[0].email,
        status: "active",
      },
      {
        id: "member-002",
        platformId: "finance",
        userId: users[12].id,
        name: users[12].name,
        email: users[12].email,
        status: "active",
      },
    ],
    users: users.map((u) => ({ id: u.id, name: u.name, email: u.email })),
    userRoles: [
      { platformId: "orion", userId: users[0].id, roleIds: ["role-platform"] },
      { platformId: "orion", userId: users[1].id, roleIds: ["role-viewer"] },
      { platformId: "orion", userId: users[5].id, roleIds: [] },
      { platformId: "finance", userId: users[0].id, roleIds: ["role-finance"] },
      {
        platformId: "finance",
        userId: users[12].id,
        roleIds: ["role-finance"],
      },
    ],
    roles: [
      {
        id: "role-platform",
        platformId: "orion",
        name: "플랫폼 관리자",
        description: "Orion 운영 관리",
        policyIds: ["policy-platform", "policy-directory"],
      },
      {
        id: "role-viewer",
        platformId: "orion",
        name: "업무 조회자",
        description: "Orion 업무 조회",
        policyIds: ["policy-directory"],
      },
      {
        id: "role-security",
        platformId: "orion",
        name: "보안 검토자",
        description: "Orion 보안 검토",
        policyIds: ["policy-security"],
      },
      {
        id: "role-operator",
        platformId: "orion",
        name: "서비스 운영자",
        description: "Orion 서비스 운영",
        policyIds: ["policy-approval-read"],
      },
      {
        id: "role-unassigned",
        platformId: "orion",
        name: "미부여 역할",
        description: "역할 구성 예제",
        policyIds: [],
      },
      {
        id: "role-finance",
        platformId: "finance",
        name: "정산 검토자",
        description: "Finance 정산 검토",
        policyIds: ["policy-settlement"],
      },
    ],
    workspaces: [
      { id: "platform", platformId: "orion", name: "플랫폼 운영" },
      { id: "ws-platform", platformId: "orion", name: "플랫폼 운영" },
      { id: "ws-directory", platformId: "orion", name: "구성원 디렉터리" },
      { id: "ws-approval", platformId: "finance", name: "결재 업무" },
      { id: "ws-empty", platformId: "finance", name: "준비 중 워크스페이스" },
    ],
    accounts: serviceAccounts.map((a) => ({
      id: a.id,
      name: a.name,
      roleIds: serviceAccountRoles[a.id] ?? [],
    })),
    organizations: [
      {
        id: organizations[0].id,
        name: organizations[0].name,
        platformId: "orion",
        roleIds: ["role-platform"],
      },
      {
        id: "org-finance",
        name: "재무팀",
        platformId: "finance",
        roleIds: ["role-finance"],
      },
    ],
    policies: [
      { id: "policy-platform", name: "인사 사용자 상세 조회" },
      { id: "policy-directory", name: "직원 기본 조회" },
      { id: "policy-security", name: "보안 검토" },
      { id: "policy-approval-read", name: "결재 조회" },
      { id: "policy-settlement", name: "정산 조회" },
    ],
  };
}
const root = globalThis as typeof globalThis & {
  orionPlatformDirectories?: Map<string, Directory>;
};
export const directories = (root.orionPlatformDirectories ??= new Map<
  string,
  Directory
>());
