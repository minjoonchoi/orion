"use client";
import {
  useState,
  startTransition,
  useId,
  cloneElement,
  type ReactElement,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DateValue, useI18n } from "@/i18n/provider";
import { PageHeading } from "@/components/ui/page-heading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Details } from "../identity/shared";
import { DetailTabs } from "../identity/detail-tabs";
import { BrowseTable } from "../identity/browse-table";
import { workflowCommand, demoActor } from "./actions";
import {
  canAddViewer,
  canExecute,
  matches,
  type State,
  type Template,
  type Document,
  type KeyRecord,
  type Input,
  type Command,
  type Target,
} from "./model";
import "./styles.css";
function useText() {
  const { locale } = useI18n();
  return (ko: string, en: string) => (locale === "en" ? en : ko);
}
const name = (rows: { id: string; name: string }[], id: string) =>
  rows.find((r) => r.id === id)?.name ?? id;
function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="wf-field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
    </div>
  );
}
function Ref({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="identity-link" href={href}>
      {children}
    </Link>
  );
}
function useMutation(s: State) {
  const router = useRouter(),
    text = useText();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return {
    busy,
    error,
    async run(command: Command) {
      setBusy(true);
      setError("");
      try {
        const r = await new Promise<
          Awaited<ReturnType<typeof workflowCommand>>
        >((resolve, reject) => {
          startTransition(async () => {
            try {
              resolve(await workflowCommand(command, s.revision));
            } catch (e) {
              reject(e);
            }
          });
        });
        if (r.error) {
          setError(
            r.error === "REVISION_CONFLICT"
              ? text(
                  "정보가 변경되었습니다. 새로고침 후 다시 시도하세요.",
                  "The data changed. Refresh and try again.",
                )
              : text(
                  "처리할 수 없습니다. 입력값, 권한 또는 진행 중인 요청을 확인하세요.",
                  "Unable to process. Check inputs, permissions, or pending requests.",
                ) + ` (${r.error})`,
          );
          return false;
        }
        router.refresh();
        return true;
      } catch {
        setError(
          text(
            "요청에 실패했습니다. 현재 처리 결과를 확인한 뒤 다시 시도하세요.",
            "Request failed. Check the current result before retrying.",
          ),
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
  };
}
function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <p role="alert" className="wf-error">
      {error}
    </p>
  ) : null;
}
function Status({ value }: { value: string }) {
  const text = useText();
  const labels: Record<string, [string, string]> = {
    pending: ["결재 진행", "In review"],
    approved: ["승인 완료", "Approved"],
    rejected: ["반려", "Rejected"],
    waiting: ["결재 대기", "Awaiting approval"],
    ready: ["처리 대기", "Ready to execute"],
    completed: ["처리 완료", "Completed"],
    active: ["사용 중", "Active"],
    revoked: ["폐기", "Revoked"],
  };
  return (
    <Badge
      tone={
        value === "rejected"
          ? "danger"
          : value === "approved" || value === "completed"
            ? "success"
            : "neutral"
      }
    >
      {labels[value] ? text(...labels[value]) : value}
    </Badge>
  );
}
export function WorkflowContext({ s, demo }: { s: State; demo: boolean }) {
  const text = useText(),
    router = useRouter();
  return demo ? (
    <div className="wf-demo" data-actor-id={s.actorId}>
      <span>
        {text(
          "데모 · AWS 저장 및 실제 권한 반영 없이 흐름을 검증합니다. 실제 키를 입력하지 마세요.",
          "Demo · No AWS storage or live authorization changes. Do not enter real keys.",
        )}
      </span>
      <Field label={text("데모 사용자", "Demo user")}>
        <select
          value={s.actorId}
          onChange={async (e) => {
            await demoActor(e.target.value);
            router.refresh();
          }}
        >
          {s.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </Field>
    </div>
  ) : null;
}
function TargetLabel({ s, target }: { s: State; target: Target }) {
  return (
    <Ref
      href={`/${target.kind === "user" ? "users" : "organizations"}/${target.id}`}
    >
      {name(target.kind === "user" ? s.users : s.organizations, target.id)}
    </Ref>
  );
}
function Endpoints({
  s,
  ids,
  previous,
  serviceId,
}: {
  s: State;
  serviceId: string;
  ids: string[];
  previous?: string[];
}) {
  const text = useText();
  const all = [...new Set([...ids, ...(previous ?? [])])];
  return (
    <div className="wf-endpoints">
      {all.map((id) => {
        const e = s.endpoints.find(
          (e) => e.id === id && e.serviceId === serviceId,
        );
        return (
          <div key={id}>
            <code>
              {e?.method} {e?.path ?? id}
            </code>
            <span>{e?.name}</span>
            {previous && (
              <Badge
                tone={
                  !ids.includes(id)
                    ? "danger"
                    : !previous.includes(id)
                      ? "success"
                      : "neutral"
                }
              >
                {!ids.includes(id)
                  ? text("삭제", "Removed")
                  : !previous.includes(id)
                    ? text("추가", "Added")
                    : text("유지", "Unchanged")}
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}
function RequestInfo({
  s,
  input,
  previous,
}: {
  s: State;
  input: Input;
  previous?: string[];
}) {
  const text = useText();
  return (
    <>
      <Details
        items={[
          {
            label: text("서비스 어카운트", "Service account"),
            value: (
              <Ref href={`/service-accounts/${input.accountId}`}>
                {name(s.accounts, input.accountId)}
              </Ref>
            ),
          },
          {
            label: text("관리 서비스", "Managed service"),
            value: (
              <Ref href={`/services/${input.serviceId}`}>
                {name(s.services, input.serviceId)}
              </Ref>
            ),
          },
          { label: "Secret name", value: <code>{input.secretName}</code> },
          { label: "Secret value key", value: <code>{input.secretKey}</code> },
          { label: text("요청 사유", "Reason"), value: input.reason },
        ]}
      />
      <h3>{text("엔드포인트 접근 범위", "Endpoint access scope")}</h3>
      <Endpoints
        s={s}
        serviceId={input.serviceId}
        ids={input.endpointIds}
        previous={previous}
      />
    </>
  );
}
export function WorkflowList({
  s,
  demo,
  kind,
}: {
  s: State;
  demo: boolean;
  kind: "approvals" | "templates" | "keys";
}) {
  const text = useText();
  return (
    <>
      <PageHeading
        title={
          kind === "approvals"
            ? text("결재", "Approvals")
            : kind === "templates"
              ? text("결재 템플릿", "Approval templates")
              : text("API 키", "API keys")
        }
        description={
          kind === "approvals"
            ? text(
                "열람 권한이 있는 문서와 결재 이후 처리 상태를 확인합니다.",
                "Documents you can view and their post-approval execution status.",
              )
            : kind === "templates"
              ? text(
                  "결재 유형, 입력 필드와 카탈로그 기반 결재선을 관리합니다.",
                  "Manage request types, input fields, and catalog-based approval lines.",
                )
              : text(
                  "승인된 결재를 근거로 관리서비스 팀이 발급한 키를 관리합니다.",
                  "Manage keys provisioned by service teams after approval.",
                )
        }
        actions={
          kind !== "templates" ? (
            <Ref href="/approvals/new">
              {text("발급 요청", "Request issuance")}
            </Ref>
          ) : (
            <CreateTemplate s={s} />
          )
        }
      />
      <WorkflowContext s={s} demo={demo} />
      {kind === "templates" ? (
        <BrowseTable
          sortValue={(r) => r.id}
          title={text("결재 템플릿 목록", "Approval templates")}
          rows={s.templates}
          searchText={(r) => r.name}
          columns={[
            {
              key: "name",
              header: text("템플릿", "Template"),
              render: (r) => (
                <Ref href={`/approval-templates/${r.id}`}>{r.name}</Ref>
              ),
            },
            {
              key: "version",
              header: text("버전", "Version"),
              render: (r) => `v${r.version}`,
            },
            {
              key: "fields",
              header: text("입력 필드", "Input fields"),
              render: (r) => r.fields.length,
            },
            {
              key: "line",
              header: text("결재선", "Approval line"),
              render: (r) => r.line.map((l) => l.label).join(" → "),
            },
          ]}
        />
      ) : kind === "approvals" ? (
        <Documents s={s} rows={s.documents} />
      ) : (
        <BrowseTable
          sortValue={(r) => r.id}
          title={text("API 키 목록", "API keys")}
          rows={s.keys}
          searchText={(k) =>
            `${k.id} ${name(s.accounts, k.accountId)} ${name(s.services, k.serviceId)} ${k.hash}`
          }
          columns={[
            {
              key: "account",
              header: text("서비스 어카운트", "Service account"),
              render: (k) => (
                <Ref href={`/api-keys/${k.id}`}>
                  {name(s.accounts, k.accountId)}
                </Ref>
              ),
            },
            {
              key: "service",
              header: text("관리 서비스", "Managed service"),
              render: (k) => name(s.services, k.serviceId),
            },
            {
              key: "status",
              header: text("상태", "Status"),
              render: (k) => <Status value={k.status} />,
            },
            {
              key: "version",
              header: text("키 버전", "Key version"),
              render: (k) => `v${k.version}`,
            },
            {
              key: "hash",
              header: "API key hash",
              render: (k) => <Hash value={k.hash} />,
            },
          ]}
        />
      )}
    </>
  );
}
function documentTitle(s: State, d: Document) {
  return `${d.template.name} · ${name(s.accounts, d.input.accountId)}`;
}
function Documents({ s, rows }: { s: State; rows: Document[] }) {
  const text = useText();
  return (
    <BrowseTable
      sortValue={(r) => r.id}
      title={text("결재 목록", "Approvals")}
      rows={rows}
      searchText={(d) => `${d.id} ${documentTitle(s, d)} ${d.input.reason}`}
      columns={[
        {
          key: "title",
          header: text("결재 문서", "Document"),
          render: (d) => (
            <>
              <Ref href={`/approvals/${d.id}`}>{documentTitle(s, d)}</Ref>
              <div className="identity-meta">{d.id}</div>
            </>
          ),
        },
        {
          key: "requester",
          header: text("요청자", "Requester"),
          render: (d) => name(s.users, d.requesterId),
        },
        {
          key: "status",
          header: text("결재 상태", "Approval status"),
          render: (d) => <Status value={d.status} />,
        },
        {
          key: "execution",
          header: text("후속 처리", "Execution"),
          render: (d) => <Status value={d.execution} />,
        },
        {
          key: "stage",
          header: text("현재 단계", "Current stage"),
          render: (d) =>
            d.status === "pending"
              ? d.line.find((l) => l.status === "pending")?.label
              : "—",
        },
      ]}
    />
  );
}
export function RequestScreen({ s, demo }: { s: State; demo: boolean }) {
  const text = useText(),
    query = useSearchParams(),
    router = useRouter();
  const existing = s.keys.find((k) => k.id === query.get("key"));
  const [templateId, setTemplateId] = useState(
    query.get("type") === "revoke"
      ? "api-key-revoke"
      : existing
        ? "api-key-replace"
        : "api-key-issue",
  );
  const template = s.templates.find((t) => t.id === templateId)!;
  const [input, setInput] = useState<Input>({
    accountId: existing?.accountId ?? query.get("account") ?? "",
    serviceId: existing?.serviceId ?? "",
    endpointIds: existing?.endpointIds ?? [],
    secretName: existing?.secretName ?? "",
    secretKey: existing?.secretKey ?? "",
    reason: "",
  });
  const [review, setReview] = useState(false);
  const mutation = useMutation(s);
  const [requestId] = useState(() => crypto.randomUUID());
  function set<K extends keyof Input>(key: K, value: Input[K]) {
    setInput((i) => ({ ...i, [key]: value }));
  }
  const fieldLabel = (key: string, fallback: string) =>
    template.fields.find((f) => f.key === key)?.label ?? fallback;
  const valid = Boolean(
    input.accountId &&
    input.serviceId &&
    input.endpointIds.length &&
    input.secretName &&
    input.secretKey &&
    input.reason.trim(),
  );
  return (
    <>
      <PageHeading
        title={template?.name ?? text("결재 요청", "Request approval")}
        description={text(
          "1. 요청 정보 선택 → 2. 변경사항과 결재선 검토",
          "1. Request details → 2. Review changes and approval line",
        )}
      />
      <WorkflowContext s={s} demo={demo} />
      <section className="ui-panel">
        <h2>
          {review
            ? text("2. 변경사항 검토", "2. Review changes")
            : text("1. 요청 정보", "1. Request details")}
        </h2>
        {!review ? (
          <div className="wf-form">
            <Field label={text("결재 템플릿", "Approval template")}>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                {s.templates
                  .filter((t) =>
                    existing ? t.type !== "issue" : t.type === "issue",
                  )
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · v{t.version}
                    </option>
                  ))}
              </select>
            </Field>
            <Field
              label={fieldLabel(
                "accountId",
                text("서비스 어카운트", "Service account"),
              )}
            >
              <select
                value={input.accountId}
                disabled={!!existing}
                onChange={(e) => set("accountId", e.target.value)}
              >
                <option value="">{text("선택하세요", "Select")}</option>
                {s.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={fieldLabel(
                "serviceId",
                text("관리 서비스", "Managed service"),
              )}
            >
              <select
                value={input.serviceId}
                disabled={!!existing}
                onChange={(e) =>
                  setInput((i) => ({
                    ...i,
                    serviceId: e.target.value,
                    endpointIds: [],
                  }))
                }
              >
                <option value="">{text("선택하세요", "Select")}</option>
                {s.services.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset className="wf-checks">
              <legend>{text("접근할 엔드포인트", "Endpoints to allow")}</legend>
              {s.endpoints
                .filter((e) => e.serviceId === input.serviceId)
                .map((e) => (
                  <label key={e.id}>
                    <input
                      type="checkbox"
                      disabled={template.type === "revoke"}
                      checked={input.endpointIds.includes(e.id)}
                      onChange={(ev) =>
                        set(
                          "endpointIds",
                          ev.target.checked
                            ? [...input.endpointIds, e.id]
                            : input.endpointIds.filter((id) => id !== e.id),
                        )
                      }
                    />
                    <code>
                      {e.method} {e.path}
                    </code>
                    <span>{e.name}</span>
                  </label>
                ))}
              {!s.endpoints.some((e) => e.serviceId === input.serviceId) && (
                <p>
                  {text(
                    "서비스를 선택하면 엔드포인트가 표시됩니다.",
                    "Select a service to view its endpoints.",
                  )}
                </p>
              )}
            </fieldset>
            <Field label={fieldLabel("secretName", "Secret name")}>
              <input
                value={input.secretName}
                readOnly={!!existing}
                maxLength={512}
                onChange={(e) => set("secretName", e.target.value)}
                placeholder="orion/service/integration"
              />
            </Field>
            <Field label={fieldLabel("secretKey", "Secret value key")}>
              <input
                value={input.secretKey}
                readOnly={!!existing}
                maxLength={128}
                onChange={(e) => set("secretKey", e.target.value)}
                placeholder="apiKey"
              />
            </Field>
            <Field
              label={fieldLabel(
                "reason",
                text("요청 사유 (필수)", "Reason (required)"),
              )}
            >
              <textarea
                value={input.reason}
                maxLength={2000}
                onChange={(e) => set("reason", e.target.value)}
                rows={3}
              />
            </Field>
            <Button disabled={!valid} onClick={() => setReview(true)}>
              {text("검토", "Review")}
            </Button>
          </div>
        ) : (
          <>
            <RequestInfo s={s} input={input} previous={existing?.endpointIds} />
            <h3>{text("결재선", "Approval line")}</h3>
            <ol className="wf-line">
              {template.line.map((l, i) => (
                <li key={i}>
                  <strong>{l.label}</strong>
                  <span>
                    {l.kind === "requester-leader"
                      ? name(
                          s.users,
                          s.leaders.find((v) => v.userId === s.actorId)
                            ?.leaderId ?? "",
                        )
                      : l.kind === "service-team"
                        ? name(
                            s.organizations,
                            s.services.find((v) => v.id === input.serviceId)
                              ?.teamId ?? "",
                          )
                        : name(
                            l.kind === "user" ? s.users : s.organizations,
                            l.id,
                          )}
                  </span>
                </li>
              ))}
            </ol>
            <p className="wf-note">
              {text(
                "승인 완료 후 관리서비스 팀이 수동으로 처리합니다. 요청만으로 키나 권한이 생성·변경되지 않습니다.",
                "The service team executes after approval. Submitting this request does not create or change keys or permissions.",
              )}
            </p>
            {existing && (
              <p>
                {text(
                  "기존 정책·역할과 Secret 저장 위치를 재사용합니다. 접근 범위 변경은 이 서비스 어카운트의 해당 역할에 적용됩니다.",
                  "The existing policy, role, and Secret location are reused. Scope changes apply to this service account role.",
                )}
              </p>
            )}
            <div className="ui-actions">
              <Button
                variant="secondary"
                disabled={mutation.busy}
                onClick={() => setReview(false)}
              >
                {text("이전", "Back")}
              </Button>
              <Button
                loading={mutation.busy}
                onClick={async () => {
                  if (
                    await mutation.run({
                      kind: "request",
                      templateId,
                      keyId: existing?.id ?? "",
                      input,
                      requestId,
                    })
                  )
                    router.push(`/approvals/${requestId}`);
                }}
              >
                {text("결재 요청", "Submit request")}
              </Button>
            </div>
          </>
        )}
        <ErrorMessage error={mutation.error} />
      </section>
    </>
  );
}
function Hash({ value }: { value: string }) {
  const text = useText();
  const [message, setMessage] = useState("");
  return (
    <div className="wf-hash">
      <code>{value}</code>
      <Button
        size="sm"
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setMessage(text("복사됨", "Copied"));
          } catch {
            setMessage(
              text(
                "복사하지 못했습니다. 값을 선택해 복사하세요.",
                "Copy failed. Select and copy the value.",
              ),
            );
          }
        }}
      >
        {text("복사", "Copy")}
      </Button>
      <span role="status">{message}</span>
    </div>
  );
}
export function DocumentScreen({
  s,
  d,
  demo,
}: {
  s: State;
  d: Document;
  demo: boolean;
}) {
  const text = useText();
  const m = useMutation(s);
  const [target, setTarget] = useState(""),
    [secret, setSecret] = useState(""),
    [confirm, setConfirm] = useState<"approved" | "rejected" | null>(null);
  const key = s.keys.find((k) => k.id === d.keyId),
    current = d.line.find((l) => l.status === "pending");
  const showDecision =
    d.status === "pending" && current && matches(s, current.target);
  return (
    <>
      <PageHeading
        title={`${d.template.name} · ${name(s.accounts, d.input.accountId)}`}
        description={`${d.id} · ${text("템플릿 스냅샷", "Template snapshot")} v${d.template.version}`}
      />
      <WorkflowContext s={s} demo={demo} />
      <DetailTabs
        items={[
          {
            value: "info",
            label: text("기본 정보", "Overview"),
            content: (
              <section className="ui-panel">
                <Details
                  items={[
                    {
                      label: text("요청자", "Requester"),
                      value: (
                        <Ref href={`/users/${d.requesterId}`}>
                          {name(s.users, d.requesterId)}
                        </Ref>
                      ),
                    },
                    {
                      label: text("결재 상태", "Approval status"),
                      value: <Status value={d.status} />,
                    },
                    {
                      label: text("후속 처리", "Execution"),
                      value: <Status value={d.execution} />,
                    },
                    {
                      label: text("요청일", "Requested at"),
                      value: <DateValue value={d.createdAt} time />,
                    },
                    {
                      label: text("API 키 관리 ID", "API key management ID"),
                      value: key ? (
                        <Ref href={`/api-keys/${key.id}`}>{key.id}</Ref>
                      ) : (
                        d.keyId
                      ),
                    },
                  ]}
                />
              </section>
            ),
          },
          {
            value: "request",
            label: text("요청 정보", "Request"),
            content: (
              <section className="ui-panel">
                <h2>{text("승인 대상 정보", "Submitted request")}</h2>
                <RequestInfo
                  s={s}
                  input={d.input}
                  previous={
                    d.template.type === "replace"
                      ? d.previousEndpointIds
                      : undefined
                  }
                />
              </section>
            ),
          },
          {
            value: "line",
            label: text("결재선", "Approval line"),
            content: (
              <section className="ui-panel">
                <h2>{text("결재선", "Approval line")}</h2>
                <ol className="wf-line">
                  {d.line.map((l, i) => (
                    <li key={i}>
                      <span className="wf-step">{i + 1}</span>
                      <div>
                        <strong>{l.label}</strong>
                        <div>
                          <TargetLabel s={s} target={l.target} />
                        </div>
                        {l.actorId && (
                          <small>
                            {name(s.users, l.actorId)} ·{" "}
                            <DateValue value={l.at} time />
                          </small>
                        )}
                      </div>
                      <Status value={l.status} />
                    </li>
                  ))}
                </ol>
                {showDecision && (
                  <div className="ui-actions">
                    <Button onClick={() => setConfirm("approved")}>
                      {current.action === "agree"
                        ? text("합의", "Agree")
                        : text("승인", "Approve")}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => setConfirm("rejected")}
                    >
                      {text("반려", "Reject")}
                    </Button>
                  </div>
                )}
                <ErrorMessage error={m.error} />
              </section>
            ),
          },
          {
            value: "viewers",
            label: text("열람자", "Viewers"),
            content: (
              <section className="ui-panel">
                <h2>{text("문서 열람자", "Document viewers")}</h2>
                <p>
                  {text(
                    "사용자 또는 등록된 조직의 현재 멤버만 목록과 상세를 조회할 수 있습니다.",
                    "Only listed users and current members of listed organizations can view this document.",
                  )}
                </p>
                <div className="wf-endpoints">
                  {d.viewers.map((v, i) => (
                    <div key={i}>
                      <TargetLabel s={s} target={v.target} />
                      <Badge>
                        {v.source === "manual"
                          ? text("수동 추가", "Manual")
                          : text("자동 등록", "Automatic")}
                      </Badge>
                      <small>
                        {name(s.users, v.addedBy)} ·{" "}
                        <DateValue value={v.at} time />
                      </small>
                    </div>
                  ))}
                </div>
                {canAddViewer(s, d) && (
                  <div className="wf-inline">
                    <Field label={text("열람자 추가", "Add viewer")}>
                      <select
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                      >
                        <option value="">
                          {text(
                            "사용자 또는 조직 선택",
                            "Select user or organization",
                          )}
                        </option>
                        <optgroup label={text("사용자", "Users")}>
                          {s.users.map((u) => (
                            <option key={u.id} value={`user:${u.id}`}>
                              {u.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label={text("조직", "Organizations")}>
                          {s.organizations.map((o) => (
                            <option key={o.id} value={`organization:${o.id}`}>
                              {o.name}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </Field>
                    <Button
                      disabled={!target}
                      loading={m.busy}
                      onClick={async () => {
                        const [kind, id] = target.split(":");
                        if (
                          await m.run({
                            kind: "viewer",
                            id: d.id,
                            target: { kind: kind as Target["kind"], id },
                          })
                        )
                          setTarget("");
                      }}
                    >
                      {text("추가", "Add")}
                    </Button>
                  </div>
                )}
                <ErrorMessage error={m.error} />
              </section>
            ),
          },
          {
            value: "execution",
            label: text("후속 처리", "Execution"),
            content: (
              <section className="ui-panel">
                <h2>{text("API 키 후속 처리", "API key execution")}</h2>
                <p>
                  {text("관리서비스 팀", "Service team")}:{" "}
                  {name(
                    s.organizations,
                    s.services.find((v) => v.id === d.input.serviceId)
                      ?.teamId ?? "",
                  )}
                </p>
                <RequestInfo s={s} input={d.input} />
                {d.execution === "completed" ? (
                  <>
                    <p>
                      <Status value="completed" /> {name(s.users, d.executorId)}{" "}
                      · <DateValue value={d.executedAt} time />
                    </p>
                    {key && (
                      <>
                        <Ref href={`/api-keys/${key.id}`}>
                          {text("API 키 상세", "API key details")}
                        </Ref>
                        <Hash
                          value={
                            key.history.find((h) => h.approvalId === d.id)
                              ?.hash ?? key.hash
                          }
                        />
                      </>
                    )}
                  </>
                ) : canExecute(s, d) ? (
                  <>
                    <p className="wf-note">
                      {d.template.type === "issue"
                        ? text(
                            "정책·역할을 생성하여 서비스 어카운트에 부여하고 지정한 Secret 필드에 저장합니다.",
                            "Create the policy and role, assign to the service account, and store in the specified Secret field.",
                          )
                        : d.template.type === "replace"
                          ? text(
                              "기존 정책의 엔드포인트와 동일 Secret 필드를 교체합니다. 기존 키는 성공 후 폐기합니다.",
                              "Update the existing policy endpoints and Secret field. Retire the previous key only after success.",
                            )
                          : text(
                              "키를 폐기하고 전용 역할 부여 및 Secret 필드를 제거합니다.",
                              "Revoke the key and remove its dedicated role assignment and Secret field.",
                            )}
                    </p>
                    {d.template.type !== "revoke" && (
                      <Field
                        label={text("저장할 API 키 원문", "API key to store")}
                      >
                        <input
                          type="password"
                          autoComplete="new-password"
                          value={secret}
                          onChange={(e) => setSecret(e.target.value)}
                          maxLength={8192}
                        />
                      </Field>
                    )}
                    <Button
                      loading={m.busy}
                      disabled={
                        d.template.type !== "revoke" && secret.length < 8
                      }
                      onClick={async () => {
                        const value = secret;
                        setSecret("");
                        await m.run({
                          kind: "execute",
                          id: d.id,
                          secretText: value,
                        });
                      }}
                    >
                      {demo
                        ? text("데모 처리 실행", "Simulate execution")
                        : d.template.type === "revoke"
                          ? text("폐기 실행", "Revoke key")
                          : text(
                              "키 저장 및 권한 적용",
                              "Store key and apply permissions",
                            )}
                    </Button>
                    <ErrorMessage error={m.error} />
                  </>
                ) : (
                  <p className="wf-note">
                    {text(
                      "최종 승인 후 관리서비스 팀이 실행할 수 있습니다.",
                      "Only the service team can execute after final approval.",
                    )}
                  </p>
                )}
              </section>
            ),
          },
        ]}
      />
      <Dialog
        trigger={null}
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={text("결재 처리 검토", "Review decision")}
        description={text(
          "요청 정보와 접근 범위를 확인한 뒤 처리하세요.",
          "Review the request and endpoint scope before confirming.",
        )}
        busy={m.busy}
      >
        <RequestInfo s={s} input={d.input} />
        <Button
          loading={m.busy}
          variant={confirm === "rejected" ? "danger" : "primary"}
          onClick={async () => {
            if (
              confirm &&
              (await m.run({ kind: "decide", id: d.id, decision: confirm }))
            )
              setConfirm(null);
          }}
        >
          {confirm === "rejected"
            ? text("반려 확정", "Confirm rejection")
            : text("승인·합의 확정", "Confirm approval")}
        </Button>
        <ErrorMessage error={m.error} />
      </Dialog>
    </>
  );
}
export function KeyScreen({
  s,
  k,
  demo,
}: {
  s: State;
  k: KeyRecord;
  demo: boolean;
}) {
  const text = useText();
  return (
    <>
      <PageHeading
        title={name(s.accounts, k.accountId)}
        description={`${name(s.services, k.serviceId)} · ${k.id}`}
        actions={
          k.status === "active" ? (
            <>
              <Ref href={`/approvals/new?key=${k.id}&type=replace`}>
                {text("교체 요청", "Request replacement")}
              </Ref>
              <Ref href={`/approvals/new?key=${k.id}&type=revoke`}>
                {text("폐기 요청", "Request revocation")}
              </Ref>
            </>
          ) : undefined
        }
      />
      <WorkflowContext s={s} demo={demo} />
      <DetailTabs
        items={[
          {
            value: "info",
            label: text("기본 정보", "Overview"),
            content: (
              <section className="ui-panel">
                <Details
                  items={[
                    {
                      label: text("상태", "Status"),
                      value: <Status value={k.status} />,
                    },
                    {
                      label: text("키 버전", "Key version"),
                      value: `v${k.version}`,
                    },
                    { label: "Secret name", value: k.secretName },
                    { label: "Secret value key", value: k.secretKey },
                    { label: "API key hash", value: <Hash value={k.hash} /> },
                  ]}
                />
              </section>
            ),
          },
          {
            value: "scope",
            label: text("접근 권한", "Access"),
            content: (
              <section className="ui-panel">
                <h2>
                  {text(
                    "역할 → 정책 → 엔드포인트",
                    "Role → Policy → Endpoints",
                  )}
                </h2>
                <Details
                  items={[
                    {
                      label: text("서비스 어카운트", "Service account"),
                      value: (
                        <Ref href={`/service-accounts/${k.accountId}`}>
                          {name(s.accounts, k.accountId)}
                        </Ref>
                      ),
                    },
                    {
                      label: text("Orion 역할", "Orion role"),
                      value: <Ref href={`/roles/${k.roleId}`}>{k.roleId}</Ref>,
                    },
                    {
                      label: text("접근 정책", "Access policy"),
                      value: (
                        <Ref href={`/policies/${k.policyId}`}>{k.policyId}</Ref>
                      ),
                    },
                  ]}
                />
                <Endpoints s={s} serviceId={k.serviceId} ids={k.endpointIds} />
              </section>
            ),
          },
          {
            value: "approvals",
            label: text("결재", "Approvals"),
            content: (
              <Documents
                s={s}
                rows={s.documents.filter((d) => d.keyId === k.id)}
              />
            ),
          },
          {
            value: "history",
            label: text("키 버전", "Key versions"),
            content: (
              <section className="ui-panel">
                <h2>{text("처리 이력", "Execution history")}</h2>
                {k.history.map((h) => (
                  <div className="wf-history" key={h.approvalId}>
                    <strong>
                      v{h.version} · {h.type} · <DateValue value={h.at} time />
                    </strong>
                    {s.documents.some((d) => d.id === h.approvalId) ? (
                      <Ref href={`/approvals/${h.approvalId}`}>
                        {h.approvalId}
                      </Ref>
                    ) : (
                      <span>
                        {text(
                          "결재 문서 열람 권한 없음",
                          "No access to approval document",
                        )}
                      </span>
                    )}
                    <Hash value={h.hash} />
                  </div>
                ))}
              </section>
            ),
          },
        ]}
      />
    </>
  );
}
export function TemplateScreen({
  s,
  t,
  demo,
}: {
  s: State;
  t: Template;
  demo: boolean;
}) {
  const text = useText(),
    m = useMutation(s);
  const [edit, setEdit] = useState(false),
    [draft, setDraft] = useState<Template>(structuredClone(t));
  const options = [
    {
      value: "requester-leader:",
      label: text("요청자 팀장", "Requester’s team lead"),
    },
    {
      value: "service-team:",
      label: text("관리서비스 팀", "Managed service team"),
    },
    ...s.users.map((u) => ({
      value: `user:${u.id}`,
      label: `${text("사용자", "User")} · ${u.name}`,
    })),
    ...s.organizations.map((o) => ({
      value: `organization:${o.id}`,
      label: `${text("조직", "Organization")} · ${o.name}`,
    })),
  ];
  return (
    <>
      <PageHeading
        title={t.name}
        description={text(
          "수정 시 새 버전으로 저장합니다. 기존 결재 스냅샷에는 영향을 주지 않습니다.",
          "Changes create a new version and do not alter existing approval snapshots.",
        )}
        actions={
          s.templateAdminIds.includes(s.actorId) && (
            <Button
              onClick={() => {
                setDraft(structuredClone(t));
                setEdit(true);
              }}
            >
              {text("템플릿 수정", "Edit template")}
            </Button>
          )
        }
      />
      <WorkflowContext s={s} demo={demo} />
      <DetailTabs
        items={[
          {
            value: "info",
            label: text("기본 정보", "Overview"),
            content: (
              <section className="ui-panel">
                <Details
                  items={[
                    { label: text("템플릿 ID", "Template ID"), value: t.id },
                    { label: text("버전", "Version"), value: `v${t.version}` },
                    {
                      label: text("처리 유형", "Execution type"),
                      value: `api-key.${t.type}`,
                    },
                    {
                      label: text(
                        "조직 단계 완료 조건",
                        "Organization step completion",
                      ),
                      value: text(
                        "현재 조직 멤버 중 한 명 처리",
                        "One current organization member decides",
                      ),
                    },
                  ]}
                />
              </section>
            ),
          },
          {
            value: "line",
            label: text("결재선", "Approval line"),
            content: (
              <section className="ui-panel">
                <h2>{text("결재선", "Approval line")}</h2>
                <ol className="wf-line">
                  {t.line.map((r, i) => (
                    <li key={i}>
                      <span className="wf-step">{i + 1}</span>
                      <strong>{r.label}</strong>
                      <span>
                        {
                          options.find((o) => o.value === `${r.kind}:${r.id}`)
                            ?.label
                        }
                      </span>
                    </li>
                  ))}
                </ol>
                <p>
                  {text(
                    "요청 시 사용자·조직을 확정하고 열람자로 자동 등록합니다.",
                    "Resolve users and organizations at submission and automatically add them as viewers.",
                  )}
                </p>
              </section>
            ),
          },
          {
            value: "fields",
            label: text("입력 필드", "Input fields"),
            content: (
              <BrowseTable
                sortValue={(r) => r.id}
                title={text("입력 필드", "Input fields")}
                rows={t.fields.map((f) => ({ ...f, id: f.key }))}
                searchText={(f) => f.label}
                columns={[
                  {
                    key: "label",
                    header: text("필드", "Field"),
                    render: (f) => f.label,
                  },
                  {
                    key: "key",
                    header: text("식별자", "Identifier"),
                    render: (f) => <code>{f.key}</code>,
                  },
                  {
                    key: "required",
                    header: text("필수", "Required"),
                    render: (f) =>
                      f.required === "yes"
                        ? text("필수", "Required")
                        : text("선택", "Optional"),
                  },
                ]}
              />
            ),
          },
        ]}
      />
      <Dialog
        trigger={null}
        open={edit}
        onOpenChange={setEdit}
        title={text("결재 템플릿 수정", "Edit approval template")}
        description={text(
          "사용자·조직 카탈로그에서 결재선을 설정합니다. API 키 처리에 필요한 필드는 필수입니다.",
          "Configure approval lines from the user and organization catalogs. Fields required for key execution remain mandatory.",
        )}
        busy={m.busy}
      >
        <div className="wf-form">
          <Field label={text("이름", "Name")}>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <h3>{text("결재선", "Approval line")}</h3>
          {draft.line.map((r, i) => (
            <div className="wf-rule" key={i}>
              <Field label={`${i + 1}. ${text("단계 이름", "Step name")}`}>
                <input
                  value={r.label}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      line: draft.line.map((v, j) =>
                        j === i ? { ...v, label: e.target.value } : v,
                      ),
                    })
                  }
                />
              </Field>
              <Field label={text("담당 대상", "Assignee")}>
                <select
                  value={`${r.kind}:${r.id}`}
                  onChange={(e) => {
                    const [kind, id] = e.target.value.split(":");
                    setDraft({
                      ...draft,
                      line: draft.line.map((v, j) =>
                        j === i ? { ...v, kind: kind as typeof r.kind, id } : v,
                      ),
                    });
                  }}
                >
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={text("단계 유형", "Step type")}>
                <select
                  value={r.action}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      line: draft.line.map((v, j) =>
                        j === i
                          ? { ...v, action: e.target.value as typeof r.action }
                          : v,
                      ),
                    })
                  }
                >
                  <option value="approve">{text("승인", "Approve")}</option>
                  <option value="agree">{text("합의", "Agree")}</option>
                </select>
              </Field>
              <div className="ui-actions">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={i === 0}
                  onClick={() => {
                    const line = [...draft.line];
                    [line[i - 1], line[i]] = [line[i], line[i - 1]];
                    setDraft({ ...draft, line });
                  }}
                >
                  {text("위로", "Move up")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      line: draft.line.filter((_, j) => j !== i),
                    })
                  }
                >
                  {text("삭제", "Remove")}
                </Button>
              </div>
            </div>
          ))}
          <Button
            variant="secondary"
            onClick={() =>
              setDraft({
                ...draft,
                line: [
                  ...draft.line,
                  {
                    label: text("승인", "Approve"),
                    action: "approve",
                    kind: "user",
                    id: s.users[0].id,
                  },
                ],
              })
            }
          >
            {text("단계 추가", "Add step")}
          </Button>
          <h3>{text("입력 필드 이름", "Input field labels")}</h3>
          {draft.fields.map((f, i) => (
            <Field key={f.key} label={`${f.key} · ${text("필수", "Required")}`}>
              <input
                value={f.label}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    fields: draft.fields.map((v, j) =>
                      i === j ? { ...v, label: e.target.value } : v,
                    ),
                  })
                }
              />
            </Field>
          ))}
          <ErrorMessage error={m.error} />
          <Button
            loading={m.busy}
            onClick={async () => {
              if (await m.run({ kind: "template", template: draft }))
                setEdit(false);
            }}
          >
            {text("새 버전 저장", "Save new version")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export function AccountWorkflow({
  s,
  accountId,
  roles = false,
}: {
  s: State;
  accountId: string;
  roles?: boolean;
}) {
  const text = useText();
  const keys = s.keys.filter((k) => k.accountId === accountId);
  return (
    <section className="ui-panel">
      <h2>
        {roles
          ? text("발급 결재로 부여된 역할", "Roles granted through issuance")
          : text("결재 기반 API 키", "Approval-based API keys")}
      </h2>
      <BrowseTable
        title={
          roles
            ? text("발급 역할 목록", "Issued roles")
            : text("발급 키 목록", "Issued keys")
        }
        rows={keys.filter((k) => !roles || k.status === "active")}
        sortValue={(k) => k.id}
        searchText={(k) => `${name(s.services, k.serviceId)} ${k.id}`}
        columns={[
          {
            key: "service",
            header: text("관리 서비스", "Managed service"),
            render: (k) => name(s.services, k.serviceId),
          },
          {
            key: "key",
            header: roles
              ? text("Orion 역할", "Orion role")
              : text("API 키", "API key"),
            render: (k) => (
              <Ref
                href={`/api-keys/${k.id}?tab=${roles ? "scope" : "approvals"}`}
              >
                {roles ? k.roleId : k.id}
              </Ref>
            ),
          },
          {
            key: "status",
            header: text("상태", "Status"),
            render: (k) => <Status value={k.status} />,
          },
        ]}
      />
      {!roles && (
        <Documents
          s={s}
          rows={s.documents.filter((d) => d.input.accountId === accountId)}
        />
      )}
    </section>
  );
}

function CreateTemplate({ s }: { s: State }) {
  const text = useText(),
    router = useRouter(),
    m = useMutation(s);
  const [open, setOpen] = useState(false),
    [type, setType] = useState<Template["type"]>("issue"),
    [title, setTitle] = useState("");
  if (!s.templateAdminIds.includes(s.actorId)) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={<Button>{text("템플릿 추가", "Add template")}</Button>}
      title={text("결재 템플릿 추가", "Add approval template")}
      description={text(
        "처리 유형의 기본 필드와 결재선으로 시작한 뒤 편집할 수 있습니다.",
        "Start with the default fields and approval line for the selected type, then edit.",
      )}
      busy={m.busy}
    >
      <div className="wf-form">
        <Field label={text("이름", "Name")}>
          <input
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label={text("처리 유형", "Execution type")}>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Template["type"])}
          >
            <option value="issue">{text("발급", "Issue")}</option>
            <option value="replace">{text("교체", "Replace")}</option>
            <option value="revoke">{text("폐기", "Revoke")}</option>
          </select>
        </Field>
        <ErrorMessage error={m.error} />
        <Button
          loading={m.busy}
          disabled={!title.trim()}
          onClick={async () => {
            const template = {
              ...structuredClone(s.templates.find((t) => t.type === type)!),
              id: `template-${crypto.randomUUID()}`,
              name: title.trim(),
              version: 0,
            };
            if (await m.run({ kind: "template", template }))
              router.push(`/approval-templates/${template.id}`);
          }}
        >
          {text("생성", "Create")}
        </Button>
      </div>
    </Dialog>
  );
}

export function ManagedGrantScreen({
  s,
  k,
  kind,
}: {
  s: State;
  k: KeyRecord;
  kind: "roles" | "policies";
}) {
  const text = useText();
  return (
    <>
      <PageHeading
        title={kind === "roles" ? k.roleId : k.policyId}
        description={text(
          "API 키 결재로 관리하는 전용 권한입니다. 변경은 키 교체·폐기 결재에서 수행합니다.",
          "Dedicated authorization managed by API key approvals. Use replacement or revocation requests to change it.",
        )}
      />
      <DetailTabs
        items={[
          {
            value: "info",
            label: text("기본 정보", "Overview"),
            content: (
              <section className="ui-panel">
                <Details
                  items={[
                    {
                      label: text("관리 방식", "Managed by"),
                      value: text("결재", "Approval"),
                    },
                    { label: text("플랫폼", "Platform"), value: "Orion" },
                    {
                      label: text("API 키", "API key"),
                      value: <Ref href={`/api-keys/${k.id}`}>{k.id}</Ref>,
                    },
                    {
                      label: text("서비스 어카운트", "Service account"),
                      value: (
                        <Ref href={`/service-accounts/${k.accountId}`}>
                          {name(s.accounts, k.accountId)}
                        </Ref>
                      ),
                    },
                    {
                      label:
                        kind === "roles"
                          ? text("정책", "Policy")
                          : text("역할", "Role"),
                      value: (
                        <Ref
                          href={
                            kind === "roles"
                              ? `/policies/${k.policyId}`
                              : `/roles/${k.roleId}`
                          }
                        >
                          {kind === "roles" ? k.policyId : k.roleId}
                        </Ref>
                      ),
                    },
                  ]}
                />
              </section>
            ),
          },
          {
            value: "endpoints",
            label: text("엔드포인트", "Endpoints"),
            content: (
              <section className="ui-panel">
                <Endpoints s={s} serviceId={k.serviceId} ids={k.endpointIds} />
              </section>
            ),
          },
          {
            value: "approvals",
            label: text("결재", "Approvals"),
            content: (
              <Documents
                s={s}
                rows={s.documents.filter((d) => d.keyId === k.id)}
              />
            ),
          },
        ]}
      />
    </>
  );
}
export function ManagedGrants({
  s,
  kind,
}: {
  s: State;
  kind: "roles" | "policies";
}) {
  const text = useText();
  return (
    <BrowseTable
      title={
        kind === "roles"
          ? text("API 키 결재 관리 역할", "Roles managed by API key approvals")
          : text(
              "API 키 결재 관리 정책",
              "Policies managed by API key approvals",
            )
      }
      rows={s.keys.filter((k) => k.status === "active")}
      sortValue={(k) => k.id}
      searchText={(k) =>
        `${k.roleId} ${k.policyId} ${name(s.accounts, k.accountId)}`
      }
      columns={[
        {
          key: "id",
          header:
            kind === "roles" ? text("역할", "Role") : text("정책", "Policy"),
          render: (k) => (
            <Ref href={`/${kind}/${kind === "roles" ? k.roleId : k.policyId}`}>
              {kind === "roles" ? k.roleId : k.policyId}
            </Ref>
          ),
        },
        {
          key: "account",
          header: text("서비스 어카운트", "Service account"),
          render: (k) => (
            <Ref href={`/service-accounts/${k.accountId}`}>
              {name(s.accounts, k.accountId)}
            </Ref>
          ),
        },
        {
          key: "service",
          header: text("관리 서비스", "Managed service"),
          render: (k) => name(s.services, k.serviceId),
        },
        {
          key: "count",
          header: text("엔드포인트", "Endpoints"),
          render: (k) => k.endpointIds.length,
        },
      ]}
    />
  );
}
