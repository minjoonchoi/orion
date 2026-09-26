"use client";
import { useI18n } from "@/i18n/provider";
import Link from "next/link";
import { DetailTabs } from "../identity/detail-tabs";
import { BrowseTable } from "../identity/browse-table";
import type { RelatedGroup } from "./repository";
export function RelatedRecords({ groups }: { groups: RelatedGroup[] }) {
  const { t } = useI18n();
  return <DetailTabs items={relatedTabs(groups, t)} />;
}
export function relatedTabs(
  groups: RelatedGroup[],
  t: (text: string) => string,
) {
  return groups.map((group) => ({
    value:
      group.title === "조직 API 키"
        ? "api-keys"
        : group.title === "서비스 어카운트"
          ? "service-accounts"
          : group.title === "템플릿을 사용한 결재"
            ? "approvals"
            : "related-" + group.title,
    label: `${t(group.title)} (${group.rows.length})`,
    content: (
      <BrowseTable
        key={group.title}
        title={group.title}
        emptyTitle={t(`${group.title} 없음`)}
        rows={group.rows}
        searchText={(r) =>
          `${r.name} ${r.id} ${(r.serviceAccounts ?? []).map((a) => a.name).join(" ")}`
        }
        sortValue={(r) => r.name}
        columns={[
          {
            key: "name",
            header: t("이름"),
            sortable: true,
            render: (r) => (
              <Link className="identity-link" href={r.href}>
                {r.name}
              </Link>
            ),
          },
          { key: "id", header: "ID", render: (r) => r.id },
          ...(group.rows.some((r) => r.serviceAccounts !== undefined)
            ? [
                {
                  key: "serviceAccounts",
                  header: t("서비스 어카운트"),
                  render: (r: (typeof group.rows)[number]) => (
                    <div className="identity-org-links">
                      {(r.serviceAccounts ?? []).map((a) => (
                        <Link
                          className="identity-link"
                          key={a.id}
                          href={`/service-accounts/${a.id}`}
                        >
                          {a.name}
                        </Link>
                      ))}
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />
    ),
  }));
}
