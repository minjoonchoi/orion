"use client";
import { useI18n } from "@/i18n/provider";
import { Explorer, type ExplorerNode } from "./explorer";
import {
  impact,
  impactForResources,
  type Graph,
  type ResourceKind,
  type ResourceRef,
} from "./model";
import "./styles.css";

type ImpactRole = Omit<
  ReturnType<typeof impact>[number]["roles"][number],
  "expired"
> & { expired?: boolean };
function roleNode(r: ImpactRole, t: (s: string) => string): ExplorerNode {
  const expired =
    r.expired ??
    Boolean(
      r.binding.expiresAt && Date.parse(r.binding.expiresAt) <= Date.now(),
    );
  return {
    id: `role:${r.role.id}`,
    name: r.role.name,
    kind: "역할",
    relation: "정책 연결",
    href: `/roles/${r.role.id}`,
    detail: `${expired ? t("만료") + " · " : ""}${t("직접 부여 사용자")} ${r.users.length} · ${t("조직")} ${r.organizations.length}`,
    children: [
      ...r.users.map((u) => ({
        id: `user:${u.id}`,
        name: u.name,
        kind: "사용자",
        relation: "직접 연결",
        href: `/users/${u.id}`,
      })),
      ...r.organizations.map((o) => ({
        id: `organization:${o.id}`,
        name: o.name,
        kind: "조직",
        relation: "역할 부여",
        href: `/organizations/${o.id}`,
        children: o.members.map((u) => ({
          id: `user:${u.id}`,
          name: u.name,
          kind: "사용자",
          relation: "조직 경유",
          href: `/users/${u.id}`,
        })),
      })),
    ],
  };
}
// Keep matching descendants with their complete ancestry; matching parents retain their subtree.
function searchNodes(nodes: ExplorerNode[], query: string): ExplorerNode[] {
  return nodes.flatMap((node) => {
    if (`${node.name} ${node.id}`.toLowerCase().includes(query)) return [node];
    const children = searchNodes(node.children ?? [], query);
    return children.length ? [{ ...node, children }] : [];
  });
}
export function ResourceImpactTree({
  graph,
  kind,
  id,
  includeExpired = false,
  query = "",
}: {
  graph: Graph;
  kind: ResourceKind;
  id: string;
  includeExpired?: boolean;
  query?: string;
}) {
  return (
    <ResourceSetImpactTree
      graph={graph}
      resources={[{ kind, id }]}
      includeExpired={includeExpired}
      query={query}
    />
  );
}
export function ResourceSetImpactTree({
  graph,
  resources,
  includeExpired = false,
  query = "",
}: {
  graph: Graph;
  resources: ResourceRef[];
  includeExpired?: boolean;
  query?: string;
}) {
  const { t } = useI18n();
  const entries = impactForResources(graph, resources, includeExpired).entries;
  const nodes: ExplorerNode[] = entries.map(({ resource, paths }) => ({
    id: `${resource.kind}:${resource.id}`,
    name:
      graph.resources.find(
        (r) => r.kind === resource.kind && r.id === resource.id,
      )?.name ??
      resource.name ??
      resource.id,
    kind: "리소스",
    detail: resource.id,
    children: paths.map((p) => ({
      id: `policy:${p.policy.id}`,
      name: p.policy.name,
      kind: "정책",
      relation: "리소스 연결",
      href: `/policies/${p.policy.id}`,
      detail: t(p.policy.effect === "allow" ? "허용" : "거부"),
      children: p.roles.map((r) => roleNode(r, t)),
    })),
  }));
  const term = query.trim().toLowerCase();
  return (
    <Explorer
      key={`${resources.map((r) => `${r.kind}:${r.id}`).join(",")}:${term}:${includeExpired}`}
      nodes={term ? searchNodes(nodes, term) : nodes}
      initialDepth={term ? Infinity : resources.length === 1 ? 2 : 1}
    />
  );
}
export function PolicyImpactTree({
  name,
  id,
  roles,
}: {
  name: string;
  id: string;
  roles: ImpactRole[];
}) {
  const { t } = useI18n();
  return (
    <Explorer
      nodes={[
        { id, name, kind: "정책", children: roles.map((r) => roleNode(r, t)) },
      ]}
      initialDepth={1}
    />
  );
}
