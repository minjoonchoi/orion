"use client";
import Link from "next/link";
import { PolicyPermissions, ActionInvocation } from "./policy-ui";
import { useState, Suspense, type ReactNode } from "react";
import { useI18n, DateValue } from "@/i18n/provider";
import { DetailTabs } from "../identity/detail-tabs";
import { BrowseTable } from "../identity/browse-table";
import { useContract } from "./state";
import { ContractScreen } from "./screen";
import { obj, arr, entries, yaml, changed, type Definition } from "./model";
import "./styles.css";
const routes: Record<string, string> = {
  platform: "platforms",
  organization: "organizations",
  domain: "domains",
  action: "actions",
  policy: "policies",
  scope: "scopes",
  service: "services",
  endpoint: "service-endpoints",
  workspace: "workspaces",
  page: "pages",
  masking: "masking-rules",
};
const labels: Record<string, string> = {
  platform: "플랫폼",
  organization: "조직",
  domain: "업무 도메인",
  action: "Action",
  policy: "정책",
  scope: "조회 범위",
  service: "서비스",
  endpoint: "엔드포인트",
  workspace: "워크스페이스",
  page: "페이지",
  masking: "마스킹 규칙",
};
export function definitionHref(d: Definition) {
  return `/${routes[d.kind]}/${encodeURIComponent((d.parent ? d.parent + "/" : "") + d.id).replaceAll("%2F", "~")}`;
}
function DefinitionTable({
  rows,
  title,
}: {
  rows: Definition[];
  title: string;
}) {
  const { t } = useI18n();
  return (
    <BrowseTable
      title={title}
      rows={rows.map((d) => ({ ...d, id: d.key }))}
      columns={[
        {
          key: "name",
          header: "이름",
          sortable: true,
          render: (d) => (
            <Link href={definitionHref({ ...d, id: d.key.split("/").at(-1)! })}>
              {t(d.name)}
            </Link>
          ),
        },
        { key: "kind", header: "유형", render: (d) => t(labels[d.kind]) },
        { key: "key", header: "식별자", render: (d) => <span>{d.key}</span> },
        {
          key: "file",
          header: "소스 파일",
          render: (d) => <span>{d.file}</span>,
        },
      ]}
      searchText={(d) => `${d.name} ${d.key} ${d.file}`}
      sortValue={(d, k) => (k === "name" ? d.name : d.key)}
    />
  );
}
export function ContractCatalog({ kind }: { kind: string }) {
  const { applied } = useContract();
  const { mode, t } = useI18n();
  if (mode !== "demo") return null;
  const rows = applied.filter((d) => d.kind === kind);
  return (
    <Suspense>
      <section className="contract ui-layout-stack">
        <h2>{t("YAML 정의")}</h2>
        <DefinitionTable title={`${labels[kind]} 정의`} rows={rows} />
      </section>
    </Suspense>
  );
}
export function ContractDetail({
  kind,
  id,
  children,
}: {
  kind: string;
  id: string;
  children?: ReactNode;
}) {
  const { mode, t } = useI18n();
  const state = useContract();
  const [fieldPhase, setFieldPhase] = useState("request");
  if (mode !== "demo")
    return (
      <>
        {children ?? (
          <p role="status">{t("새 정의 계약의 운영 API 연결이 필요합니다.")}</p>
        )}
      </>
    );
  const resolvedId =
    kind === "policy" && id === "employee~regional-reader"
      ? "regional-reader"
      : id;
  const entity = state.applied.find(
    (d) =>
      d.kind === kind &&
      (d.parent ? d.parent.replaceAll("/", "~") + "~" : "") + d.id ===
        resolvedId,
  );
  if (!entity)
    return (
      <>
        {children ?? (
          <section>
            <h1>{t("항목을 찾을 수 없습니다")}</h1>
            <Link href="/domains">{t("업무 도메인")}</Link>
          </section>
        )}
      </>
    );
  if (entity.kind === "action")
    return (
      <>
        <p>
          <Link href={`/domains/${entity.parent}`}>
            {t("업무 도메인")}: {entity.parent}
          </Link>
        </p>
        <ActionInvocation entity={entity} />
        <ContractScreen view="actions" action={entity.key} />
      </>
    );
  const targets = state.applied.filter((d) => entity.refs.includes(d.key));
  const incoming = state.applied.filter((d) => d.refs.includes(entity.key));
  const childrenOf = (k: string) =>
    state.applied.filter(
      (d) =>
        d.kind === k &&
        d.parent === (entity.parent ? entity.parent + "/" : "") + entity.id,
    );
  const related = (
    <div className="ui-layout-stack">
      <DefinitionTable rows={targets} title="참조하는 정의" />
      <DefinitionTable rows={incoming} title="사용 중인 정의" />
    </div>
  );
  const info = (
    <section className="ui-panel ui-layout-stack">
      <dl>
        <dt>{t("식별자")}</dt>
        <dd>{entity.key}</dd>
        <dt>{t("소스 파일")}</dt>
        <dd>{entity.file}</dd>
        {entity.kind === "service" && (
          <>
            <dt>{t("관리 조직")}</dt>
            <dd>
              <Link href={`/organizations/${entity.data.organization}`}>
                {String(entity.data.organization)}
              </Link>
            </dd>
          </>
        )}
        {entity.kind === "workspace" && (
          <>
            <dt>{t("소속 플랫폼")}</dt>
            <dd>{entity.parent}</dd>
          </>
        )}
        {entity.kind === "policy" && (
          <>
            <dt>{t("효과")}</dt>
            <dd>{entity.data.effect === "deny" ? t("거부") : t("허용")}</dd>
          </>
        )}
      </dl>
    </section>
  );
  const history = (
    <section className="ui-panel ui-layout-stack">
      <h2>{t("동기화 이력")}</h2>
      {state.history
        .filter((h) => h.keys.includes(entity.key))
        .map((h) => (
          <div key={h.revision}>
            <strong>v{h.revision}</strong> · <DateValue value={h.at} time />
          </div>
        ))}
      {!state.history.some((h) => h.keys.includes(entity.key)) && (
        <p>{t("이번 검토에서 실행한 동기화가 없습니다.")}</p>
      )}
      <Link
        className="ui-button ui-button--secondary ui-button--md"
        href="/definition-sync"
      >
        {t("정의 동기화")}
      </Link>
    </section>
  );
  const fields = (
    <section className="ui-panel ui-layout-stack">
      <label>
        {t("필드 구분")}
        <select
          value={fieldPhase}
          onChange={(e) => setFieldPhase(e.target.value)}
        >
          <option value="request">{t("요청 필드")}</option>
          <option value="response">{t("응답 필드")}</option>
        </select>
      </label>
      <div className="contract-table">
        <table>
          <thead>
            <tr>
              {["필드", "위치", "타입", "필수", "민감정보", "마스킹 규칙"].map(
                (x) => (
                  <th key={x}>{t(x)}</th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {entries(obj(entity.data[fieldPhase]).fields).map(([name, raw]) => {
              const f = obj(raw);
              return (
                <tr key={name}>
                  <td>{name}</td>
                  <td>
                    {String(f.location ?? "body")} · {String(f.path)}
                  </td>
                  <td>{String(f.type)}</td>
                  <td>{f.required ? t("필수") : "—"}</td>
                  <td>{f.privacy ? t("민감정보") : "—"}</td>
                  <td>
                    {f.privacy ? (
                      <Link href={`/masking-rules/${f.masking ?? "redact"}`}>
                        {String(f.masking ?? "redact")}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
  const scopes = (
    <section className="ui-panel ui-layout-stack">
      <h2>{t("조직별 조회 범위")}</h2>
      <div className="contract-table">
        <table>
          <thead>
            <tr>
              <th>{t("조직")}</th>
              <th>{t("코드")}</th>
            </tr>
          </thead>
          <tbody>
            {arr(entity.data.organizations).map((o) => (
              <tr key={String(obj(o).organization)}>
                <td>
                  <Link href={`/organizations/${obj(o).organization}`}>
                    {String(obj(o).organization)}
                  </Link>
                </td>
                <td>{arr(obj(o).codes).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        {t("빈 매핑은 전체 조회가 아닙니다. Gateway에서 요청을 차단합니다.")}
      </p>
    </section>
  );
  const items =
    entity.kind === "domain"
      ? [
          {
            value: "actions",
            label: "Action",
            content: (
              <DefinitionTable
                title="도메인 Action"
                rows={childrenOf("action")}
              />
            ),
          },
          {
            value: "policies",
            label: "관련 정책",
            content: (
              <DefinitionTable
                title="관련 정책"
                rows={state.applied.filter(
                  (d) =>
                    d.kind === "policy" &&
                    d.refs.some((r) => r.startsWith(`action/${entity.id}/`)),
                )}
              />
            ),
          },
          {
            value: "scopes",
            label: "조회 범위",
            content: (
              <DefinitionTable
                title="도메인 조회 범위"
                rows={childrenOf("scope")}
              />
            ),
          },
          {
            value: "pages",
            label: "사용 페이지",
            content: (
              <DefinitionTable
                title="사용 페이지"
                rows={state.applied.filter(
                  (d) =>
                    d.kind === "page" &&
                    d.refs.some((r) => r.startsWith(`action/${entity.id}/`)),
                )}
              />
            ),
          },
        ]
      : entity.kind === "service"
        ? [
            {
              value: "endpoints",
              label: "엔드포인트",
              content: (
                <DefinitionTable
                  title="서비스 엔드포인트"
                  rows={childrenOf("endpoint")}
                />
              ),
            },
          ]
        : entity.kind === "endpoint"
          ? [
              { value: "fields", label: "필드 명세", content: fields },
              {
                value: "actions",
                label: "사용 Action",
                content: (
                  <DefinitionTable
                    title="동일 엔드포인트의 Action"
                    rows={incoming.filter((d) => d.kind === "action")}
                  />
                ),
              },
            ]
          : entity.kind === "policy"
            ? [
                {
                  value: "actions",
                  label: "실행 권한",
                  content: <PolicyPermissions entity={entity} />,
                },
              ]
            : entity.kind === "workspace"
              ? [
                  {
                    value: "pages",
                    label: "페이지",
                    content: (
                      <DefinitionTable
                        title="워크스페이스 페이지"
                        rows={childrenOf("page")}
                      />
                    ),
                  },
                ]
              : entity.kind === "page"
                ? [
                    {
                      value: "actions",
                      label: "사용 Action",
                      content: (
                        <DefinitionTable
                          title="페이지의 Action"
                          rows={targets.filter((d) => d.kind === "action")}
                        />
                      ),
                    },
                  ]
                : entity.kind === "scope"
                  ? [
                      { value: "mapping", label: "조직 매핑", content: scopes },
                      {
                        value: "actions",
                        label: "사용 Action",
                        content: (
                          <DefinitionTable
                            title="조회 범위의 Action"
                            rows={incoming.filter((d) => d.kind === "action")}
                          />
                        ),
                      },
                    ]
                  : [];
  return (
    <div className="contract ui-layout-stack">
      <header>
        <h1>{t(entity.name)}</h1>
        <p>{entity.key}</p>
      </header>
      <div className="contract-heading">
        <span>
          {changed(
            entity,
            state.desired.find((d) => d.key === entity.key),
          )
            ? "Out of sync"
            : "Synced"}{" "}
          · DB v{state.revision}
        </span>
        <Link
          className="ui-button ui-button--secondary ui-button--md"
          href="/definition-sync"
        >
          {t("변경사항 검토")}
        </Link>
      </div>
      {info}
      <DetailTabs
        items={[
          ...items,
          { value: "relations", label: "관계", content: related },
          { value: "history", label: "동기화 이력", content: history },
          {
            value: "yaml",
            label: "YAML",
            content: <pre>{yaml(entity.data)}</pre>,
          },
        ]}
      />
    </div>
  );
}
