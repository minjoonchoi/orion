"use client";
import Link from "next/link";
import { useI18n } from "@/i18n/provider";
import { BrowseTable } from "../identity/browse-table";
import type { KeyRow } from "../api-keys/types";
export function LegacyKeys({ rows }: { rows: KeyRow[] }) {
  const { locale } = useI18n();
  return (
    <details className="ui-panel">
      <summary>
        {locale === "en"
          ? "Existing keys · migration required"
          : "기존 API 키 · 결재 스냅샷 이관 필요"}{" "}
        ({rows.length})
      </summary>
      <p>
        {locale === "en"
          ? "Existing metadata is preserved. Migrate approved scope and Secret locations before enabling replacement."
          : "기존 메타데이터를 보존합니다. 승인 범위와 Secret 저장 위치 이관 후 교체 기능을 사용할 수 있습니다."}
      </p>
      <BrowseTable
        title={locale === "en" ? "Existing keys" : "기존 API 키"}
        rows={rows}
        sortValue={(r) => r.name}
        searchText={(r) => r.name}
        columns={[
          {
            key: "name",
            header: locale === "en" ? "Name" : "이름",
            render: (r) => (
              <Link className="identity-link" href={`/api-keys/${r.id}`}>
                {r.name}
              </Link>
            ),
          },
          {
            key: "account",
            header: locale === "en" ? "Service account" : "서비스 어카운트",
            render: (r) => r.serviceAccount.name,
          },
          {
            key: "service",
            header: locale === "en" ? "Managed service" : "관리 서비스",
            render: (r) => r.service.name,
          },
        ]}
      />
    </details>
  );
}
