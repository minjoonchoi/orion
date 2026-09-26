"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DateValue, useI18n } from "@/i18n/provider";
import type { Graph } from "./model";
import {
  subjectImpact,
  compareSubjectImpact,
  type ImpactScope,
  type SubjectKind,
  type ImpactSubject,
} from "./subject-impact";
import "./subject-impact.css";
const labels: Record<SubjectKind, string> = {
  users: "사용자",
  organizations: "조직",
  "service-accounts": "서비스 어카운트",
};
const kinds = Object.keys(labels) as SubjectKind[];
const href = (kind: string, id: string) => `/${kind}/${encodeURIComponent(id)}`;

export function SubjectImpact({
  graph,
  scope,
  afterGraph,
}: {
  graph: Graph;
  scope: ImpactScope;
  afterGraph?: Graph;
}) {
  const { t } = useI18n();
  const [kind, setKind] = useState<SubjectKind | "all">("all");
  const [query, setQuery] = useState("");
  const [expired, setExpired] = useState(false);
  const [page, setPage] = useState(1);
  const subjects = afterGraph
    ? compareSubjectImpact(graph, afterGraph, scope, expired)
    : subjectImpact(graph, scope, expired);
  const missingAccounts =
    graph.serviceAccounts === undefined ||
    Boolean(afterGraph && afterGraph.serviceAccounts === undefined);
  const term = query.trim().toLowerCase();
  const scoped = subjects.filter((s) => kind === "all" || s.kind === kind);
  const filtered = scoped.filter((s) =>
    `${s.name} ${s.id} ${s.paths.map((p) => `${p.role.name} ${p.role.id} ${p.policy.name} ${p.policy.id} ${p.resources.map((r) => `${r.name} ${r.id}`).join(" ")}`).join(" ")}`
      .toLowerCase()
      .includes(term),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const current = Math.min(page, pages);
  return (
    <section className="subject-impact" aria-label={t("영향받는 대상")}>
      <h3>{t(afterGraph ? "변경으로 영향받는 대상" : "영향받는 대상")}</h3>
      <dl className="subject-counts" aria-label={t("영향 대상 요약")}>
        {kinds.map((k) => (
          <div key={k}>
            <dt>{t(labels[k])}</dt>
            <dd>
              {k === "service-accounts" && missingAccounts
                ? "—"
                : subjects.filter((s) => s.kind === k).length}
            </dd>
          </div>
        ))}
      </dl>
      <p className="muted">
        {t(
          "대상 수는 중복을 제외합니다. 각 대상을 펼치면 영향을 받는 역할·정책 경로를 확인할 수 있습니다.",
        )}
      </p>
      {missingAccounts && (
        <p role="status" className="subject-incomplete">
          {t(
            "서비스 어카운트 관계 정보가 제공되지 않아 해당 영향도는 확인할 수 없습니다.",
          )}
        </p>
      )}
      <div className="subject-tools">
        <label className="subject-search">
          {t("영향 대상·경로 검색")}
          <input
            value={query}
            placeholder={t("이름·역할·정책·리소스 검색")}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="subject-type-filter">
          {t("영향 대상 유형")}
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as SubjectKind | "all");
              setPage(1);
            }}
          >
            <option value="all">{t("전체")}</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {t(labels[k])}
              </option>
            ))}
          </select>
        </label>
        <label className="subject-expired">
          <input
            type="checkbox"
            checked={expired}
            onChange={(e) => {
              setExpired(e.target.checked);
              setPage(1);
            }}
          />
          {t("만료된 부여 포함")}
        </label>
      </div>
      <div className="subject-results" aria-live="polite">
        {t(
          kind === "all"
            ? missingAccounts
              ? "확인된 대상"
              : "전체"
            : labels[kind],
        )}{" "}
        ·{" "}
        {kind === "service-accounts" && missingAccounts ? "—" : filtered.length}
        {term && ` / ${scoped.length}`}
      </div>
      <div className="subject-list">
        {filtered.slice((current - 1) * 8, current * 8).map((s) => (
          <SubjectRow
            key={`${kind}:${s.kind}:${s.id}:${term}:${expired}:${current}`}
            subject={s}
            graph={afterGraph ?? graph}
          />
        ))}
      </div>
      {!filtered.length &&
        !(kind === "service-accounts" && missingAccounts) && (
          <p className="subject-empty">
            {t(
              term
                ? "검색 결과가 없습니다."
                : "이 범위에 해당하는 대상이 없습니다.",
            )}
          </p>
        )}
      {pages > 1 && (
        <div className="subject-pagination">
          <Button
            variant="secondary"
            size="sm"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            {t("이전")}
          </Button>
          <span>
            {current} / {pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            {t("다음")}
          </Button>
        </div>
      )}
      <p className="muted">
        {t(
          "사용자는 직접 역할이 부여된 대상만 표시합니다. 조직은 멤버를 펼치지 않고 별도 대상으로 표시합니다.",
        )}
      </p>
      <p className="muted">
        {t("관계 기준이며 최종 접근 허용 여부는 서버에서 판정합니다.")}
      </p>
    </section>
  );
}
function SubjectRow({
  subject: s,
  graph,
}: {
  subject: ImpactSubject;
  graph: Graph;
}) {
  const { t } = useI18n();
  const [limit, setLimit] = useState(5);
  const roles = [
    ...new Map(s.paths.map((p) => [p.role.id, p.role.name])).values(),
  ];
  const policies = [
    ...new Map(s.paths.map((p) => [p.policy.id, p.policy.name])).values(),
  ];
  const org = graph.organizations.find((o) => o.id === s.organizationId);
  return (
    <details className="subject-row">
      <summary>
        <div>
          <span className="subject-title">
            <strong>{s.name}</strong>
            <span className="subject-type">{t(labels[s.kind])}</span>
          </span>
          <small>
            {s.id}
            {org && ` · ${t("소속 조직")}: ${org.name}`}
          </small>
          <span className="subject-route-summary">
            {t("역할")} · {roles.slice(0, 2).join(", ")}
            {roles.length > 2 ? ` +${roles.length - 2}` : ""}
            <span aria-hidden="true"> → </span>
            {t("정책")} · {policies.slice(0, 2).join(", ")}
            {policies.length > 2 ? ` +${policies.length - 2}` : ""}
          </span>
        </div>
        <span className="subject-path-count">
          {s.paths.length} {t("영향 경로")}
        </span>
      </summary>
      <div className="subject-paths">
        <div className="subject-path-heading">
          <strong>{t("영향 경로")}</strong>
          <Link href={href(s.kind, s.id)}>{t("대상 상세 보기")} ↗</Link>
        </div>
        {s.paths.slice(0, limit).map((p) => (
          <article
            key={`${p.key}:${p.change ?? "current"}`}
            className="subject-path"
          >
            <div className="subject-path-meta">
              <span>{t("직접 부여")}</span>
              {p.change && (
                <span
                  className={
                    p.change === "removed" ? "review-removed" : "review-added"
                  }
                >
                  {t(
                    p.change === "removed" ? "해제되는 경로" : "추가되는 경로",
                  )}
                </span>
              )}
              <span>{t(p.policy.effect === "allow" ? "허용" : "거부")}</span>
              {p.expired && <strong>{t("만료")}</strong>}
              {p.expiresAt && (
                <span>
                  {t("만료 시점")}: <DateValue value={p.expiresAt} time />
                </span>
              )}
            </div>
            <ol
              className="subject-path-chain"
              aria-label={t("대상에서 리소스까지의 경로")}
            >
              <li>
                <small>{t("역할")}</small>
                <Link href={href("roles", p.role.id)}>{p.role.name}</Link>
              </li>
              <li>
                <small>{t("정책")}</small>
                <Link href={href("policies", p.policy.id)}>
                  {p.policy.name}
                </Link>
              </li>
              <li>
                <small>
                  {t("리소스")} · {p.resources.length}
                </small>
                <div className="subject-path-resources">
                  {p.resources.map((r) => (
                    <Link key={`${r.kind}:${r.id}`} href={href(r.kind, r.id)}>
                      {r.name || r.id}
                      <small>{r.id}</small>
                    </Link>
                  ))}
                </div>
              </li>
            </ol>
          </article>
        ))}
        {s.paths.length > limit && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setLimit(limit + 5)}
          >
            {t("영향 경로 더 보기")} · {s.paths.length - limit}
          </Button>
        )}
      </div>
    </details>
  );
}
