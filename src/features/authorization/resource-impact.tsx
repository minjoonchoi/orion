"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/provider";
import { type Graph, type ResourceRef } from "./model";
import { SubjectImpact } from "./subject-impact-view";
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
  const [focus, setFocus] = useState("all");
  const selected = [
    ...new Map(resources.map((r) => [`${r.kind}:${r.id}`, r])).values(),
  ];
  const scoped =
    focus === "all"
      ? selected
      : selected.filter((r) => `${r.kind}:${r.id}` === focus);
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
      <div className="impact-scope subject-resource-scope">
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
      <SubjectImpact key={focus} graph={graph} scope={{ resources: scoped }} />
      <p className="muted">
        {t(
          "사용자 수는 중복을 제외합니다. 서비스·워크스페이스의 하위 리소스 권한을 자동으로 포함하지 않습니다.",
        )}
      </p>
    </section>
  );
}
