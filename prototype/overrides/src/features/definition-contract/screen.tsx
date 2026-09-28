"use client";
import { ActionContractComparison } from "./action-comparison";
import { selectableRowProps } from "@/components/ui/selectable-row";
import { PolicySyncImpact } from "./policy-ui";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import { useI18n } from "@/i18n/provider";
import { useContract } from "./state";
import {
  obj,
  arr,
  entries,
  yaml,
  validate,
  changed,
  makePlan,
  affected,
  mask,
} from "./model";
import "./styles.css";
const names: Record<string, string> = {
  platform: "플랫폼",
  organization: "조직",
  masking: "마스킹 규칙",
  service: "서비스",
  endpoint: "엔드포인트",
  domain: "업무 도메인",
  scope: "조회 범위",
  action: "Action",
  policy: "정책",
  workspace: "워크스페이스",
  page: "페이지",
};
export function ContractScreen(props: { view?: string; action?: string } = {}) {
  const { mode, t } = useI18n();
  if (mode !== "demo")
    return (
      <section>
        <h1>{t("정의와 실행 계약")}</h1>
        <p role="status">{t("새 정의 계약의 운영 API 연결이 필요합니다.")}</p>
      </section>
    );
  return <ContractContent {...props} />;
}
const emptyDefinition = {
  key: "",
  kind: "",
  id: "",
  parent: "",
  name: "",
  file: "",
  data: {},
  refs: [],
} as import("./model").Definition;
function ContractContent({
  view,
  action: selectedAction,
}: { view?: string; action?: string } = {}) {
  const { t, mode } = useI18n();
  const params = useSearchParams();
  const {
    desired,
    applied,
    setApplied,
    revision,
    setRevision,
    history,
    setHistory,
  } = useContract();
  const [tab, setTab] = useState(view ?? params.get("view") ?? "actions");
  const [actionId, setActionId] = useState(
    selectedAction ?? applied.find((d) => d.kind === "action")?.key ?? "",
  );
  const [selection, setSelection] = useState<string[]>(() =>
    desired
      .filter((d) =>
        changed(
          applied.find((a) => a.key === d.key),
          d,
        ),
      )
      .map((d) => d.key),
  );
  const [review, setReview] = useState<{
    plan: ReturnType<typeof makePlan>;
    revision: number;
    expires: number;
  } | null>(null);
  const [stage, setStage] = useState(1);
  const [ack, setAck] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [detail, setDetail] = useState<string | null>(null);
  const [maskId, setMaskId] = useState(
    applied.find((d) => d.kind === "masking")?.id ?? "",
  );
  const [scopeKey, setScopeKey] = useState(
    applied.find((d) => d.kind === "scope")?.key ?? "",
  );
  const [sample, setSample] = useState("minjoon@example.com");
  const deltas = desired.filter((d) =>
    changed(
      applied.find((a) => a.key === d.key),
      d,
    ),
  );
  const action =
    applied.find(
      (d) => d.kind === "action" && (d.key === actionId || d.id === actionId),
    ) ?? emptyDefinition;
  const ep = obj(action.data.endpoint);
  const endpoint =
    applied.find((d) => d.key === `endpoint/${ep.service}/${ep.endpoint}`) ??
    emptyDefinition;
  const scope = applied.find((d) => d.key === scopeKey) ?? emptyDefinition;
  const wantedScope = desired.find((d) => d.key === scope.key) ?? scope;
  const masking =
    applied.find((d) => d.key === `masking/${maskId}`) ?? emptyDefinition;
  const chosen = applied.find((d) => d.key === detail);
  const summary = (label: string, value: string | number) => (
    <div className="contract-metric">
      <span>{t(label)}</span>
      <strong>{value}</strong>
    </div>
  );
  function openReview() {
    setError("");
    setStage(1);
    setAck(false);
    setReview({
      plan: makePlan(applied, desired, selection),
      revision,
      expires: Date.now() + 300000,
    });
  }
  function apply() {
    if (!review) return;
    if (review.revision !== revision || review.expires < Date.now()) {
      setError(t("검토 기준이 변경되었거나 만료되었습니다. 다시 검토하세요."));
      return;
    }
    if (review.plan.errors.length || !ack) return;
    setApplied(review.plan.next);
    setRevision(revision + 1);
    setHistory([
      {
        revision: revision + 1,
        keys: review.plan.changes.map((d) => d.key),
        at: new Date().toISOString(),
      },
      ...history,
    ]);
    setReview(null);
    setSelection([]);
    setNotice(t("정의가 적용되었습니다. Gateway 반영 확인은 대기 중입니다."));
  }
  const actionsView = (
    <div className="ui-layout-stack">
      <div className="contract-toolbar">
        <label>
          {t("업무 Action")}
          <select
            value={actionId}
            onChange={(e) => setActionId(e.target.value)}
          >
            {applied
              .filter((d) => d.kind === "action")
              .map((d) => (
                <option key={d.key} value={d.key}>
                  {t(d.name)}
                </option>
              ))}
          </select>
        </label>
        <Button variant="secondary" onClick={() => setDetail(endpoint.key)}>
          {t("엔드포인트 명세")}
        </Button>
      </div>
      <section className="ui-panel ui-layout-stack">
        <div>
          <h2>{t(action.name)}</h2>
          <p className="contract-muted">
            {action.parent} / {action.id}
          </p>
        </div>
        <div className="contract-facts">
          {summary("관리서비스", String(ep.service))}
          {summary(
            "엔드포인트",
            `${endpoint.data.method} ${endpoint.data.path}`,
          )}
          {summary("적용 기준", `DB · v${revision}`)}
        </div>
        <p>
          {t(
            "같은 엔드포인트여도 Action에 따라 요청과 반환 범위가 달라집니다.",
          )}
        </p>
      </section>
      <ActionContractComparison
        action={action}
        endpoint={endpoint}
        phase="request"
      />
      <ActionContractComparison
        action={action}
        endpoint={endpoint}
        phase="response"
      />
      <section className="ui-panel">
        <h2>{t("사용 관계")}</h2>
        <div className="contract-table">
          <table>
            <thead>
              <tr>
                <th>{t("유형")}</th>
                <th>{t("이름")}</th>
                <th>{t("의미")}</th>
              </tr>
            </thead>
            <tbody>
              {applied
                .filter((d) => d.refs.includes(action.key))
                .map((d) => (
                  <tr key={d.key} {...selectableRowProps()}>
                    <td>{t(names[d.kind])}</td>
                    <td>
                      <button
                        className="contract-link"
                        onClick={() => setDetail(d.key)}
                      >
                        {t(d.name)}
                      </button>
                    </td>
                    <td>
                      {t(
                        d.kind === "policy"
                          ? "Action 실행 허용"
                          : "페이지에서 사용 · 권한 자동 부여 없음",
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
  const scopeView = (
    <div className="ui-layout-stack">
      <label>
        {t("조회 범위")}
        <select value={scopeKey} onChange={(e) => setScopeKey(e.target.value)}>
          {applied
            .filter((d) => d.kind === "scope")
            .map((d) => (
              <option key={d.key} value={d.key}>
                {t(d.name)} · {d.parent}
              </option>
            ))}
        </select>
      </label>
      <section className="ui-panel ui-layout-stack">
        <div>
          <h2>{t(scope.name)}</h2>
          <p className="contract-muted">
            {scope.parent} / {scope.id}
          </p>
        </div>
        <div className="contract-facts">
          {summary("코드", arr(scope.data.codes).length)}
          {summary("매핑 조직", arr(scope.data.organizations).length)}
          {summary(
            "사용 Action",
            applied.filter((d) => d.refs.includes(scope.key)).length,
          )}
        </div>
        <div className="contract-table">
          <table>
            <thead>
              <tr>
                <th>{t("코드")}</th>
                <th>{t("이름")}</th>
              </tr>
            </thead>
            <tbody>
              {arr(scope.data.codes).map((c) => (
                <tr key={String(obj(c).code)}>
                  <td>{String(obj(c).code)}</td>
                  <td>{t(String(obj(c).name))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="ui-panel ui-layout-stack">
        <h2>{t("조직별 조회 범위")}</h2>
        <div className="contract-table">
          <table>
            <thead>
              <tr>
                {["전사 조직", "적용된 코드", "Git 변경안", "상태"].map((x) => (
                  <th key={x}>{t(x)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {arr(scope.data.organizations).map((o) => (
                <tr key={String(obj(o).organization)}>
                  <td>
                    {t(
                      applied.find(
                        (d) => d.key === `organization/${obj(o).organization}`,
                      )?.name ?? String(obj(o).organization),
                    )}
                  </td>
                  <td>{arr(obj(o).codes).join(", ")}</td>
                  <td>
                    {arr(
                      obj(
                        arr(wantedScope.data.organizations).find(
                          (x) => obj(x).organization === obj(o).organization,
                        ),
                      ).codes,
                    ).join(", ")}
                  </td>
                  <td>
                    {changed(scope, wantedScope) ? "Out of sync" : "Synced"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="contract-muted">
          {t("빈 매핑은 전체 조회가 아닙니다. Gateway에서 요청을 차단합니다.")}
        </p>
        <Button variant="secondary" onClick={() => setTab("sync")}>
          {t("변경사항 검토")}
        </Button>
      </section>
    </div>
  );
  const maskView = (
    <div className="ui-layout-stack">
      <section className="ui-panel ui-layout-stack">
        <h2>{t("공통 마스킹 규칙")}</h2>
        <div className="contract-toolbar">
          <label>
            {t("규칙")}
            <select
              value={maskId}
              onChange={(e) => {
                setMaskId(e.target.value);
                setSample(
                  e.target.value === "email"
                    ? "minjoon@example.com"
                    : e.target.value === "name"
                      ? "김민준"
                      : "sample-value",
                );
              }}
            >
              {applied
                .filter((d) => d.kind === "masking")
                .map((d) => (
                  <option key={d.key}>{d.id}</option>
                ))}
            </select>
          </label>
          <label>
            {t("가상 입력")}
            <input
              value={sample}
              onChange={(e) => setSample(e.target.value)}
              maxLength={200}
            />
          </label>
        </div>
        <div className="contract-facts">
          {summary("처리 방식", String(masking.data.method))}
          {summary("처리 결과", mask(sample, masking.data))}
        </div>
        <p className="contract-muted">
          {t(
            "실제 개인정보 대신 가상 값을 사용하세요. 원문 반환 Action도 로그에는 이 규칙을 적용합니다.",
          )}
        </p>
        <details>
          <summary>{t("규칙 설정")}</summary>
          <div className="ui-disclosure-body ui-layout-stack">
            <pre>{yaml(masking.data)}</pre>
          </div>
        </details>
      </section>
      <section className="ui-panel">
        <h2>{t("참조 필드")}</h2>
        <div className="contract-table">
          <table>
            <thead>
              <tr>
                {["엔드포인트", "구분", "필드", "로그"].map((l) => (
                  <th key={l}>{t(l)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {applied
                .filter((d) => d.kind === "endpoint")
                .flatMap((d) =>
                  ["request", "response"].flatMap((p) =>
                    entries(obj(d.data[p]).fields)
                      .filter(
                        ([, f]) =>
                          obj(f).privacy &&
                          (obj(f).masking ?? "redact") === maskId,
                      )
                      .map(([f]) => (
                        <tr key={d.key + p + f}>
                          <td>
                            {d.parent} / {d.id}
                          </td>
                          <td>{t(p === "request" ? "요청" : "응답")}</td>
                          <td>{f}</td>
                          <td>{t("항상 마스킹")}</td>
                        </tr>
                      )),
                  ),
                )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
  const syncView = (
    <div className="ui-layout-stack">
      <section className="ui-panel ui-layout-stack">
        <div className="contract-heading">
          <div>
            <h2>{t("GitOps 동기화")}</h2>
            <p className="contract-muted">
              {t(
                "Git 변경을 검토한 뒤 적용합니다. DB 적용과 Gateway 반영은 별도로 확인합니다.",
              )}
            </p>
          </div>
          <span className="sync-status">
            {deltas.length ? "Out of sync" : "Synced"}
          </span>
        </div>
        <div className="contract-facts">
          {summary("Git 소스", "review-source-02")}
          {summary("DB 적용", `v${revision}`)}
          {summary("Gateway 반영", "v7")}
        </div>
        <p>
          {t(
            revision === 7
              ? "Gateway가 적용된 DB revision과 일치합니다."
              : "DB 적용 완료 · Gateway 반영 확인 대기",
          )}
        </p>
      </section>
      <section className="ui-panel ui-layout-stack">
        <div className="contract-heading">
          <h2>{t("적용할 변경")}</h2>
          <Button disabled={!selection.length} onClick={openReview}>
            {t("동기화 검토")} ({selection.length})
          </Button>
        </div>
        <div className="contract-table">
          <table>
            <thead>
              <tr>
                <th>{t("선택")}</th>
                <th>{t("정의")}</th>
                <th>{t("유형")}</th>
                <th>{t("소스 파일")}</th>
              </tr>
            </thead>
            <tbody>
              {deltas.map((d) => (
                <tr key={d.key} {...selectableRowProps()}>
                  <td>
                    <input
                      aria-label={t(d.name)}
                      type="checkbox"
                      checked={selection.includes(d.key)}
                      onChange={(e) =>
                        setSelection(
                          e.target.checked
                            ? [...selection, d.key]
                            : selection.filter((k) => k !== d.key),
                        )
                      }
                    />
                  </td>
                  <td>
                    {t(d.name)}
                    <small>{d.key}</small>
                  </td>
                  <td>{t(names[d.kind])}</td>
                  <td>{d.file}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!deltas.length && <p>{t("적용할 변경이 없습니다.")}</p>}
      </section>
      <section className="ui-panel ui-layout-stack">
        <h2>{t("적용 이력")}</h2>
        {history.length ? (
          history.map((h) => (
            <div key={h.revision}>
              <strong>
                v{h.revision} · {t("적용 완료")}
              </strong>
              <p>
                {h.at} · {h.keys.join(", ")}
              </p>
              <p className="contract-muted">{t("Gateway 반영 확인 대기")}</p>
            </div>
          ))
        ) : (
          <p className="contract-muted">
            {t("이번 검토에서 실행한 동기화가 없습니다.")}
          </p>
        )}
      </section>
    </div>
  );
  const definitionsView = (
    <div className="ui-layout-stack">
      <div className="contract-toolbar">
        <label>
          {t("정의 검색")}
          <input
            placeholder={t("이름 또는 식별자 검색")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          {t("유형")}
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">{t("전체")}</option>
            {Object.entries(names).map(([k, n]) => (
              <option key={k} value={k}>
                {t(n)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <section className="ui-panel">
        <div className="contract-table">
          <table>
            <thead>
              <tr>
                {["정의", "유형", "소스 파일", "상태"].map((n) => (
                  <th key={n}>{t(n)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {applied
                .filter(
                  (d) =>
                    (kind === "all" || d.kind === kind) &&
                    `${d.name} ${d.key}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                )
                .map((d) => (
                  <tr key={d.key} {...selectableRowProps()}>
                    <td>
                      <button
                        className="contract-link"
                        onClick={() => setDetail(d.key)}
                      >
                        {t(d.name)}
                      </button>
                      <small>{d.key}</small>
                    </td>
                    <td>{t(names[d.kind])}</td>
                    <td>{d.file}</td>
                    <td>
                      {changed(
                        d,
                        desired.find((x) => x.key === d.key),
                      )
                        ? "Out of sync"
                        : "Synced"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
  if (mode !== "demo")
    return (
      <section>
        <h1>
          {t(
            view === "sync"
              ? "정의 동기화"
              : view === "masking"
                ? "마스킹 규칙"
                : view === "scopes"
                  ? "조회 범위"
                  : selectedAction
                    ? action.name
                    : "정의와 실행 계약",
          )}
        </h1>
        <p>{t("새 정의 계약의 운영 API 연결이 필요합니다.")}</p>
      </section>
    );
  return (
    <div className="contract ui-layout-stack">
      <header>
        <h1>
          {t(
            view === "sync"
              ? "정의 동기화"
              : view === "masking"
                ? "마스킹 규칙"
                : view === "scopes"
                  ? "조회 범위"
                  : selectedAction
                    ? action.name
                    : "정의와 실행 계약",
          )}
        </h1>
        <p className="contract-muted">
          {t("업무별 요청·응답, 조회 범위와 GitOps 적용 결과를 확인합니다.")}
        </p>
      </header>
      {notice && (
        <p role="status" className="ui-panel">
          {notice}
        </p>
      )}
      {view ? (
        view === "sync" ? (
          syncView
        ) : view === "masking" ? (
          maskView
        ) : view === "scopes" ? (
          scopeView
        ) : (
          actionsView
        )
      ) : (
        <Tabs
          label={t("정의와 실행 계약")}
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "actions", label: "Action 계약", content: actionsView },
            { value: "scopes", label: "조회 범위", content: scopeView },
            { value: "masking", label: "마스킹", content: maskView },
            { value: "sync", label: "GitOps 동기화", content: syncView },
            {
              value: "definitions",
              label: "전체 정의",
              content: definitionsView,
            },
          ]}
        />
      )}
      <Dialog
        trigger={null}
        title="동기화 검토"
        description={
          stage === 1
            ? "1 / 2 · 대상과 필수 참조 확인"
            : "2 / 2 · 변경사항과 영향도 검토"
        }
        open={!!review}
        onOpenChange={(v) => {
          if (!v) setReview(null);
        }}
        size="wide"
      >
        <div className="contract ui-layout-stack">
          {error && <p role="alert">{error}</p>}
          {review && stage === 1 && (
            <>
              <p>
                {t(
                  "선택한 정의와 필요한 참조를 함께 검증합니다. 변경 없는 참조는 다시 저장하지 않습니다.",
                )}
              </p>
              <div className="contract-table">
                <table>
                  <thead>
                    <tr>
                      <th>{t("정의")}</th>
                      <th>{t("포함 사유")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {review.plan.keys.map((k) => (
                      <tr key={k}>
                        <td>{k}</td>
                        <td>
                          {t(selection.includes(k) ? "직접 선택" : "필수 참조")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>Git · review-source-02 / DB · v{review.revision}</p>
            </>
          )}
          {review && stage === 2 && (
            <>
              <section className="ui-layout-stack">
                <h2>{t("변경 결과")}</h2>
                {review.plan.changes
                  .filter((d) => d.kind === "scope")
                  .map((d) => (
                    <div className="contract-table" key={d.key}>
                      <table>
                        <thead>
                          <tr>
                            <th>{t("조직")}</th>
                            <th>{t("변경 전")}</th>
                            <th>{t("변경 후")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {arr(d.data.organizations).map((o) => (
                            <tr key={String(obj(o).organization)}>
                              <td>{String(obj(o).organization)}</td>
                              <td>
                                {arr(
                                  obj(
                                    arr(
                                      applied.find((x) => x.key === d.key)?.data
                                        .organizations,
                                    ).find(
                                      (x) =>
                                        obj(x).organization ===
                                        obj(o).organization,
                                    ),
                                  ).codes,
                                ).join(", ")}
                              </td>
                              <td>{arr(obj(o).codes).join(", ")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                {review.plan.changes.some((d) => d.kind === "scope") && (
                  <p>
                    {t(
                      "조회 범위의 변경을 확인하세요. 실제 조회 건수는 엔드포인트 데이터에 따라 달라집니다.",
                    )}
                  </p>
                )}
                {review.plan.changes
                  .filter((d) => d.kind !== "scope")
                  .map((d) => (
                    <div key={d.key}>
                      <strong>{t(d.name)}</strong>
                      <p>
                        {t(
                          d.kind === "action"
                            ? "요청·응답 필드와 원문 반환 규칙 변경"
                            : d.kind === "masking"
                              ? "응답과 로그의 공통 마스킹 규칙 변경"
                              : d.kind === "policy"
                                ? "Action 실행 허용·거부 그룹 변경"
                                : "정의와 참조 관계 변경",
                        )}
                      </p>
                    </div>
                  ))}
              </section>
              <section>
                <h2>{t("영향받는 업무와 화면")}</h2>
                <PolicySyncImpact
                  keys={review.plan.changes.map((d) => d.key)}
                  next={review.plan.next}
                />
                <div className="contract-table">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("유형")}</th>
                        <th>{t("정의")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {affected(
                        [...applied, ...review.plan.next],
                        review.plan.changes.map((d) => d.key),
                      )
                        .filter(
                          (d, i, a) =>
                            a.findIndex((x) => x.key === d.key) === i,
                        )
                        .map((d) => (
                          <tr key={d.key} {...selectableRowProps()}>
                            <td>{t(names[d.kind])}</td>
                            <td>
                              {t(d.name)}
                              <small>{d.key}</small>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <p className="contract-muted">
                  {t(
                    "역할·사용자 영향은 권한 부여 데이터 연동 후 확인할 수 있습니다.",
                  )}
                </p>
              </section>
              <details>
                <summary>{t("YAML 변경사항")}</summary>
                <div className="ui-disclosure-body ui-layout-stack">
                  {review.plan.changes.map((d) => (
                    <div key={d.key}>
                      <h3>{d.key}</h3>
                      <div className="contract-diff">
                        <div>
                          <strong>{t("변경 전")}</strong>
                          <pre>
                            {yaml(applied.find((x) => x.key === d.key)?.data)}
                          </pre>
                        </div>
                        <div>
                          <strong>{t("변경 후")}</strong>
                          <pre>{yaml(d.data)}</pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
              {review.plan.errors.map((e) => (
                <p role="alert" key={e}>
                  {e}
                </p>
              ))}
              <label className="contract-check">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                {t("변경사항과 조회 범위 영향을 확인했습니다.")}
              </label>
            </>
          )}
          <div className="contract-actions">
            <Button
              variant="secondary"
              onClick={() => (stage === 1 ? setReview(null) : setStage(1))}
            >
              {t(stage === 1 ? "취소" : "이전")}
            </Button>
            {stage === 1 ? (
              <Button onClick={() => setStage(2)}>{t("변경사항 검토")}</Button>
            ) : (
              <Button
                disabled={!ack || !!review?.plan.errors.length}
                onClick={apply}
              >
                {t("동기화 적용")}
              </Button>
            )}
          </div>
        </div>
      </Dialog>
      <Dialog
        trigger={null}
        title={chosen?.name ?? "정의"}
        description={chosen?.key ?? ""}
        open={!!chosen}
        onOpenChange={(v) => {
          if (!v) setDetail(null);
        }}
        size="wide"
      >
        <div className="contract ui-layout-stack">
          <p>
            {chosen?.file} · DB v{revision}
          </p>
          {chosen && (
            <>
              <h3>{t("참조 관계")}</h3>
              {chosen.refs.length ? (
                chosen.refs.map((r) => (
                  <button
                    className="contract-link"
                    key={r}
                    onClick={() => setDetail(r)}
                  >
                    {r}
                  </button>
                ))
              ) : (
                <p>{t("없음")}</p>
              )}
              <pre>{yaml(chosen?.data)}</pre>
            </>
          )}
        </div>
      </Dialog>
      <p className="contract-muted">
        {t("원본 정의는 Git에서 변경하고 검토 후 동기화합니다.")} ·{" "}
        {t("참조 검증")}: {validate(desired).length ? t("오류") : t("통과")}
      </p>
    </div>
  );
}
