import {
  organizations,
  serviceAccounts,
  organizationServices,
} from "../identity/fixtures";
import { apiKeys } from "../api-keys/fixtures";
import {
  serviceAccountRoles,
  serviceAccountKeys,
} from "../service-accounts/fixtures";
import { accessRepository } from "../access/repository";
import { approvalRepository } from "../approvals/repository";
export type RelationKind =
  | "users"
  | "organizations"
  | "roles"
  | "policies"
  | "services"
  | "service-endpoints"
  | "workspaces"
  | "api-keys"
  | "approval-templates";
export type RelatedRecord = {
  id: string;
  name: string;
  href: string;
  serviceAccounts?: { id: string; name: string }[];
};
export type RelatedGroup = { title: string; rows: RelatedRecord[] };
const records = (
  route: string,
  items: { id: string; name: string }[],
): RelatedRecord[] =>
  items.map((i) => ({ ...i, href: `/${route}/${encodeURIComponent(i.id)}` }));
// Inverse lookups use explicit associations only, never inferred permissions.
export async function getRelatedGroups(
  kind: RelationKind,
  id: string,
): Promise<RelatedGroup[]> {
  switch (kind) {
    case "roles":
      return [
        {
          title: "서비스 어카운트",
          rows: records(
            "service-accounts",
            serviceAccounts.filter((a) =>
              (serviceAccountRoles[a.id] ?? []).includes(id),
            ),
          ),
        },
      ];
    case "api-keys":
      return [
        {
          title: "서비스 어카운트",
          rows: records(
            "service-accounts",
            serviceAccounts.filter((a) =>
              (serviceAccountKeys[a.id] ?? []).includes(id),
            ),
          ),
        },
      ];
    case "organizations":
      return [
        {
          title: "조직 API 키",
          rows: apiKeys.flatMap((key) => {
            const linked = serviceAccounts.filter(
              (account) =>
                account.organizationId === id &&
                (serviceAccountKeys[account.id] ?? []).includes(key.id),
            );
            return linked.length
              ? [
                  {
                    id: key.id,
                    name: key.name,
                    href: `/api-keys/${key.id}`,
                    serviceAccounts: linked.map(({ id, name }) => ({
                      id,
                      name,
                    })),
                  },
                ]
              : [];
          }),
        },
      ];
    case "users": {
      const approvals = await approvalRepository.listApprovals();
      return [
        {
          title: "소유 API 키",
          rows: records(
            "api-keys",
            apiKeys.filter((k) => k.ownerId === id),
          ),
        },
        {
          title: "요청한 결재",
          rows: records(
            "approvals",
            approvals
              .filter((a) => a.requesterId === id)
              .map((a) => ({ id: a.id, name: a.title })),
          ),
        },
        {
          title: "처리한 결재",
          rows: records(
            "approvals",
            approvals
              .filter((a) => a.reviewerId === id)
              .map((a) => ({ id: a.id, name: a.title })),
          ),
        },
      ];
    }
    case "approval-templates":
      return [
        {
          title: "템플릿을 사용한 결재",
          rows: records(
            "approvals",
            (await approvalRepository.listApprovals())
              .filter((a) => a.templateId === id)
              .map((a) => ({ id: a.id, name: a.title })),
          ),
        },
      ];
    case "policies": {
      const roles = await accessRepository.listRoles();
      const details = await Promise.all(
        roles.map((r) => accessRepository.getRole(r.id)),
      );
      return [
        {
          title: "정책을 포함한 역할",
          rows: records(
            "roles",
            roles.filter((_, i) =>
              details[i]?.policies.some((p) => p.id === id),
            ),
          ),
        },
      ];
    }
    case "services":
    case "service-endpoints":
    case "workspaces": {
      const policies = await accessRepository.listPolicies();
      const field =
        kind === "services"
          ? "serviceIds"
          : kind === "service-endpoints"
            ? "endpointIds"
            : "workspaceIds";
      const groups: RelatedGroup[] = [
        {
          title: "정책",
          rows: records(
            "policies",
            policies.filter((p) => p[field].includes(id)),
          ),
        },
      ];
      if (kind === "services")
        groups.push({
          title: "관리 조직",
          rows: records(
            "organizations",
            organizations.filter((o) =>
              (organizationServices[o.id] ?? []).includes(id),
            ),
          ),
        });
      return groups;
    }
  }
}
