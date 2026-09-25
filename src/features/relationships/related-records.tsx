"use client";
import Link from "next/link";
import { BrowseTable } from "../identity/browse-table";
import type { RelatedGroup } from "./repository";
export function RelatedRecords({ groups }: { groups: RelatedGroup[] }) {
  return (
    <section className="relationship-section" aria-label="관련 항목">
      <h2>관련 항목</h2>
      <p className="identity-role-note">
        직접 연결된 관계를 조회합니다. 항목을 선택하면 상세 화면으로 이동합니다.
      </p>
      <div className="ui-stack">
        {groups.map((group) => (
          <BrowseTable
            key={group.title}
            title={group.title}
            emptyTitle={`${group.title} 없음`}
            rows={group.rows}
            searchText={(r) => `${r.name} ${r.id}`}
            sortValue={(r) => r.name}
            columns={[
              {
                key: "name",
                header: "이름",
                sortable: true,
                render: (r) => (
                  <Link className="identity-link" href={r.href}>
                    {r.name}
                  </Link>
                ),
              },
              { key: "id", header: "ID", render: (r) => r.id },
            ]}
          />
        ))}
      </div>
    </section>
  );
}
