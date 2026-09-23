import { endpoints, workspaces } from "../resources/fixtures";
import type { Endpoint, Workspace, PageRow } from "../resources/types";
import * as identity from "../identity/fixtures";
import type {
  ManagedService,
  Organization,
  Role,
  User,
} from "../identity/types";
export type Policy = {
  effect?: "allow" | "deny";
  pageIds?: string[];
  id: string;
  name: string;
  description: string;
  serviceIds: string[];
  endpointIds: string[];
  workspaceIds: string[];
};
export type RoleRow = Role & {
  userCount: number;
  organizationCount: number;
  policyCount: number;
};
export type PolicyRow = Policy & {
  serviceCount: number;
  endpointCount: number;
  workspaceCount: number;
};
export type RoleDetail = {
  role: RoleRow;
  users: User[];
  organizations: Organization[];
  policies: PolicyRow[];
};
export type PolicyDetail = {
  policy: PolicyRow;
  services: ManagedService[];
  endpoints: (Endpoint & { serviceName: string })[];
  workspaces: Workspace[];
  pages?: PageRow[];
};
// Synthetic relationships describe linked resources only, not effective permissions.
const policies: Policy[] = [
  {
    id: "policy-platform",
    name: "플랫폼 조회",
    description: "플랫폼 역할·정책 조회 리소스 연결",
    serviceIds: ["svc-orion"],
    endpointIds: ["ep-roles", "ep-policies"],
    workspaceIds: ["ws-platform"],
  },
  {
    id: "policy-directory",
    name: "구성원 조회",
    description: "구성원과 조직 조회 리소스 연결",
    serviceIds: ["svc-directory"],
    endpointIds: ["ep-users", "ep-orgs"],
    workspaceIds: ["ws-directory"],
  },
  {
    id: "policy-security",
    name: "보안 검토",
    description: "보안 검토용 플랫폼과 디렉터리 연결",
    serviceIds: ["svc-orion", "svc-directory"],
    endpointIds: ["ep-roles", "ep-policies", "ep-users", "ep-orgs"],
    workspaceIds: ["ws-platform", "ws-directory"],
  },
  {
    id: "policy-approval-read",
    name: "결재 조회",
    description: "결재 이력 조회 리소스 연결",
    serviceIds: ["svc-approval"],
    endpointIds: ["ep-approvals"],
    workspaceIds: ["ws-approval"],
  },
  {
    id: "policy-approval-submit",
    name: "결재 요청",
    description: "결재 요청 리소스 연결",
    serviceIds: ["svc-approval"],
    endpointIds: ["ep-approval-submit"],
    workspaceIds: ["ws-approval"],
  },
  {
    id: "policy-settlement",
    name: "정산 조회",
    description: "정산 서비스 연결",
    serviceIds: ["svc-settlement"],
    endpointIds: [],
    workspaceIds: [],
  },
  {
    id: "policy-unassigned",
    name: "미연결 정책",
    description: "연결 리소스가 없는 예제 정책",
    serviceIds: [],
    endpointIds: [],
    workspaceIds: [],
  },
];
const rolePolicies: Record<string, string[]> = {
  "role-platform": ["policy-platform", "policy-directory"],
  "role-viewer": ["policy-directory", "policy-approval-read"],
  "role-security": ["policy-security"],
  "role-operator": ["policy-approval-read", "policy-approval-submit"],
};
const roles: Role[] = [
  ...identity.roles,
  {
    id: "role-unassigned",
    name: "미연결 역할",
    description: "사용자·조직·정책이 연결되지 않은 예제 역할",
  },
  {
    id: "role-finance",
    name: "정산 검토자",
    description: "정산 검토를 위한 예제 역할",
  },
];
rolePolicies["role-finance"] = ["policy-settlement"];
const policyRows = (): PolicyRow[] =>
  policies.map((p) => ({
    ...p,
    effect: "allow" as const,
    serviceCount: p.serviceIds.length,
    endpointCount: p.endpointIds.length,
    workspaceCount: p.workspaceIds.length,
  }));
const linkedUsers = (id: string) =>
  identity.users.filter((u) => (identity.userRoles[u.id] ?? []).includes(id));
const linkedOrgs = (id: string) =>
  identity.organizations.filter((o) =>
    (identity.organizationRoles[o.id] ?? []).includes(id),
  );
const roleRows = (): RoleRow[] =>
  roles.map((r) => ({
    ...r,
    userCount: linkedUsers(r.id).length,
    organizationCount: linkedOrgs(r.id).length,
    policyCount: (rolePolicies[r.id] ?? []).length,
  }));
export const accessRepository = {
  async listRoles() {
    return roleRows();
  },
  async listPolicies() {
    return policyRows();
  },
  async getRole(id: string): Promise<RoleDetail | null> {
    const role = roleRows().find((r) => r.id === id);
    return role
      ? {
          role,
          users: linkedUsers(id),
          organizations: linkedOrgs(id),
          policies: policyRows().filter((p) =>
            (rolePolicies[id] ?? []).includes(p.id),
          ),
        }
      : null;
  },
  async getPolicy(id: string): Promise<PolicyDetail | null> {
    const policy = policyRows().find((p) => p.id === id);
    return policy
      ? {
          policy,
          services: identity.services.filter((s) =>
            policy.serviceIds.includes(s.id),
          ),
          endpoints: endpoints
            .filter((e) => policy.endpointIds.includes(e.id))
            .map((e) => ({
              ...e,
              serviceName: identity.services.find((s) => s.id === e.serviceId)!
                .name,
            })),
          workspaces: workspaces.filter((w) =>
            policy.workspaceIds.includes(w.id),
          ),
        }
      : null;
  },
};
