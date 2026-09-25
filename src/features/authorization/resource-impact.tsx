"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/provider";
import { impactForResources, type Graph, type ResourceRef } from "./model";
import { ResourceSetImpactTree } from "./impact-tree";
const kindLabels = {
  services: "서비스",
  "service-endpoints": "서비스 엔드포인트",
  workspaces: "워크스페이스",
  pages: "페이지",
};

export function ResourceImpact({
  graph,
  resources,
}: {
  graph: Graph;
  resources: ResourceRef[];
}) {
  const { t } = useI18n();
  const [expired, setExpired] = useState(false);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState("all");
  const selected = [
    ...new Map(resources.map((r) => [`${r.kind}:${r.id}`, r])).values(),
  ];
  const scoped =
    focus === "all"
      ? selected
      : selected.filter((r) => `${r.kind}:${r.id}` === focus);
  const { counts } = impactForResources(graph, scoped, expired);
  function name(ref: ResourceRef) {
    return (
      graph.resources.find((r) => r.kind === ref.kind && r.id === ref.id)
        ?.name ??
      ref.name ??
      ref.id
    );
  }
  return (
    <section className="access-impact" aria-label={t("영향 범위 탐색")}>
      <h3>{t("영향 범위 탐색")}</h3>
      <div className="impact-scope">
        <strong>
          {t("조회 대상 리소스")} · {scoped.length}
        </strong>
        <ul>
          {scoped.map((r) => (
            <li key={`${r.kind}:${r.id}`}>
              <span>{name(r)}</span>
              <small>
                {t(kindLabels[r.kind])} · {r.id}
              </small>
            </li>
          ))}
        </ul>
      </div>
      {selected.length > 1 && (
        <label className="impact-focus">
          {t("영향도 조회 범위")}
          <select
            value={focus}
            onChange={(e) => {
              setFocus(e.target.value);
              setQuery("");
            }}
          >
            <option value="all">
              {t("선택한 리소스 전체")} · {selected.length}
            </option>
            {selected.map((r) => (
              <option key={`${r.kind}:${r.id}`} value={`${r.kind}:${r.id}`}>
                {name(r)} · {r.id}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="muted">
        {t("조회 대상 리소스에 연결된 항목만 집계하며, 중복은 제외합니다.")}
      </p>
      <div className="access-metrics" aria-label={t("선택 범위 영향도 요약")}>
        {[
          [t("정책"), counts.policies],
          [t("역할"), counts.roles],
          [t("조직"), counts.organizations],
          [t("사용자"), counts.users],
        ].map(([label, count]) => (
          <div key={label}>
            <strong>{count}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="access-tools">
        <label>
          {t("관계 검색")}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("정책·역할·조직·사용자 검색")}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={expired}
            onChange={(e) => setExpired(e.target.checked)}
          />
          {t("만료된 연결 포함")}
        </label>
      </div>
      <p className="muted">
        {t(
          "들여쓰기와 연결선은 연결 깊이를 나타냅니다. 조직 경유 사용자는 조직 아래에 표시됩니다.",
        )}
      </p>
      <ResourceSetImpactTree
        graph={graph}
        resources={scoped}
        includeExpired={expired}
        query={query}
      />
      <p className="muted">
        {t(
          "사용자 수는 중복을 제외합니다. 서비스·워크스페이스의 하위 리소스 권한을 자동으로 포함하지 않습니다.",
        )}
      </p>
      <p className="muted">
        {t("연결 관계 기준이며 최종 접근 허용 여부는 서버에서 판정합니다.")}
      </p>
    </section>
  );
}
