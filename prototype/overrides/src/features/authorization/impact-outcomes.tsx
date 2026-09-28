"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/provider";
import { BrowseTable } from "@/features/identity/browse-table";
import type { Graph } from "./model";
import type { ImpactSubject } from "./subject-impact";

export function ImpactOutcomes({
  before,
  after,
  subjects,
}: {
  before: Graph;
  after?: Graph;
  subjects: ImpactSubject[];
}) {
  const { t } = useI18n();
  const people = new Map<
    string,
    { id: string; name: string; kind: "users" | "service-accounts" }
  >();
  for (const subject of subjects) {
    if (subject.kind === "organizations") {
      for (const graph of [before, after].filter(Boolean) as Graph[]) {
        for (const id of graph.organizations.find((o) => o.id === subject.id)
          ?.memberIds ?? []) {
          people.set("users:" + id, {
            id,
            name: graph.users.find((u) => u.id === id)?.name ?? id,
            kind: "users",
          });
        }
      }
    } else
      people.set(subject.kind + ":" + subject.id, {
        id: subject.id,
        name: subject.name,
        kind: subject.kind,
      });
  }
  const refs = [
    ...new Map(
      subjects
        .flatMap((s) => s.paths.flatMap((p) => p.resources))
        .map((r) => [r.kind + ":" + r.id, r]),
    ).values(),
  ];
  const [now] = useState(() => Date.now());
  function state(
    g: Graph,
    p: { id: string; kind: string },
    ref: { id: string; kind: string },
  ) {
    if (p.kind === "service-accounts" && !g.serviceAccounts) return "확인 불가";
    const roles = g.roles.filter((r) =>
      p.kind === "users"
        ? r.userIds.includes(p.id) ||
          r.organizationIds.some((id) =>
            g.organizations.find((o) => o.id === id)?.memberIds.includes(p.id),
          )
        : g.serviceAccounts?.find((a) => a.id === p.id)?.roleIds.includes(r.id),
    );
    const bindings = roles
      .flatMap((r) => r.bindings)
      .filter((b) => !b.expiresAt || Date.parse(b.expiresAt) > now);
    const policies = g.policies.filter(
      (p) =>
        bindings.some((b) => b.policyId === p.id) &&
        p.resources.some((r) => r.kind === ref.kind && r.id === ref.id),
    );
    return policies.some((p) => p.effect === "deny")
      ? "거부 정의 있음"
      : policies.some((p) => p.effect === "allow")
        ? "허용 정의 있음"
        : "허용 정의 없음";
  }
  const rows = [...people.values()].flatMap((p) =>
    refs.map((r) => ({
      id: p.kind + ":" + p.id + ":" + r.kind + ":" + r.id,
      name: p.name,
      kind: p.kind,
      resource: r.name ?? r.id,
      before: state(before, p, r),
      after: after ? state(after, p, r) : "비교할 변경안 없음",
    })),
  );
  return (
    <section className="ui-layout-stack">
      <h3>{t("변경 결과 사전 검토")}</h3>
      <p role="status">
        {t(
          "조직 구성원과 다른 역할의 직접 참조까지 비교합니다. 플랫폼 멤버 상태·조건부 정책·간접 리소스 관계는 최종 접근 판정에 포함되지 않았습니다.",
        )}
      </p>
      <BrowseTable
        title={t("대상별 변경 전후")}
        rows={rows}
        searchText={(r) => r.name + r.resource + r.before + r.after}
        sortValue={(r) => r.name}
        columns={[
          { key: "name", header: t("대상"), render: (r) => r.name },
          {
            key: "resource",
            header: t("업무 / 리소스"),
            render: (r) => r.resource,
          },
          { key: "before", header: t("변경 전"), render: (r) => t(r.before) },
          { key: "after", header: t("변경 후"), render: (r) => t(r.after) },
          {
            key: "result",
            header: t("변화"),
            render: (r) =>
              t(
                !after
                  ? "확인 필요"
                  : r.before === r.after
                    ? "정의 기준 유지"
                    : "정의 변경",
              ),
          },
        ]}
      />
      <details className="ui-panel">
        <summary>{t("분석 범위 및 확인 필요 항목")}</summary>
        <div className="ui-disclosure-body ui-layout-stack">
          <p>{t("응답 필드·마스킹 변화: 평가 정보 없음")}</p>
          <p>
            {t(
              "조직 구성원은 제공된 명단에 한합니다. 전체 대상 누락 여부와 최종 실효 권한은 서버 평가 결과로 확인해야 합니다.",
            )}
          </p>
          <p>
            {t(
              "정의 기준 유지에는 다른 역할의 허용·거부 정의가 반영됩니다. 접근 유지 또는 영향 없음으로 확정하지 않습니다.",
            )}
          </p>
        </div>
      </details>
    </section>
  );
}
