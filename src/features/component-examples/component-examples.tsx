"use client";
import { useI18n } from "@/i18n/provider";
import { useRef, useState, type FormEvent } from "react";
import { PageHeading } from "@/components/ui/page-heading";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs } from "@/components/ui/tabs";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionMenu } from "@/components/ui/action-menu";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { DataTable, type Column, type Sort } from "@/components/ui/data-table";
import { TableToolbar } from "@/components/ui/table-toolbar";
import { Pagination } from "@/components/ui/pagination";
import {
  PermissionMatrix,
  permissionKey,
} from "@/components/ui/permission-matrix";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};
const initialUsers: User[] = [
  "김가람",
  "김다온",
  "김하늘",
  "박나래",
  "박서준",
  "서도윤",
  "윤지안",
  "이가온",
  "이서연",
  "정다솜",
  "최도현",
  "한지우",
].map((name, i) => ({
  id: `example-${i}`,
  name,
  email: `member${i + 1}@example.test`,
  role: i % 3 === 0 ? "관리자" : "조회자",
  active: i % 4 !== 0,
}));
const resources = [
  { id: "users", label: "사용자", actions: ["read", "write", "delete"] },
  { id: "servers", label: "서버", actions: ["read", "write", "delete"] },
  { id: "audit", label: "감사 로그", actions: ["read"] },
];
const permissionActions = [
  { id: "read", label: "조회" },
  { id: "write", label: "수정" },
  { id: "delete", label: "삭제" },
];
export function ComponentExamples() {
  return (
    <ToastProvider>
      <Examples />
    </ToastProvider>
  );
}
function Examples() {
  const { t } = useI18n();
  const notify = useToast();
  const [tab, setTab] = useState("table");
  const [guideOpen, setGuideOpen] = useState(false);
  return (
    <>
      <Breadcrumbs
        items={[{ label: t("개요"), href: "/" }, { label: t("컴포넌트") }]}
      />
      <PageHeading
        title={t("백오피스 컴포넌트")}
        description={t(
          "Orion의 목록, 입력, 권한 편집에 사용하는 공통 UI입니다.",
        )}
        actions={
          <Dialog
            variant="drawer"
            open={guideOpen}
            onOpenChange={setGuideOpen}
            title={t("컴포넌트 사용 안내")}
            description={t("목록과 편집 화면에 공통 패턴을 적용합니다.")}
            trigger={<Button variant="secondary">{t("사용 안내")}</Button>}
          >
            <div className="ui-stack">
              <h3>{t("목록에서 작업 시작")}</h3>
              <p>
                {t(
                  "검색과 필터로 대상을 찾은 뒤 행 메뉴 또는 일괄 작업을 사용합니다.",
                )}
              </p>
              <h3>{t("중요한 변경 확인")}</h3>
              <p>{t("삭제 같은 작업은 대상과 결과를 확인한 후 실행합니다.")}</p>
              <h3>{t("권한은 필요한 만큼")}</h3>
              <p>
                {t(
                  "지원되는 작업만 선택할 수 있습니다. 실제 권한 변경은 서버 검증이 필요합니다.",
                )}
              </p>
            </div>
          </Dialog>
        }
      />
      <Alert title={t("예제 데이터로 동작합니다")}>
        {t(
          "이 화면의 변경은 브라우저 메모리에만 반영되며 새로고침하면 초기화됩니다.",
        )}
      </Alert>
      <Tabs
        label={t("컴포넌트 분류")}
        value={tab}
        onValueChange={setTab}
        items={[
          {
            value: "table",
            label: t("목록과 작업"),
            content: <TableExample />,
          },
          {
            value: "forms",
            label: t("입력과 피드백"),
            content: (
              <FormExamples
                onNotify={() =>
                  notify(
                    t("알림 예제"),
                    t("알림은 잠시 표시되며 직접 닫을 수 있습니다."),
                  )
                }
              />
            ),
          },
          {
            value: "permissions",
            label: t("권한 매트릭스"),
            content: <PermissionExample />,
          },
        ]}
      />
    </>
  );
}
function TableExample() {
  const { t } = useI18n();
  const notify = useToast();
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [formError, setFormError] = useState<{ name?: string; email?: string }>(
    {},
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const normalized = query.trim().toLocaleLowerCase();
  const filtered = users.filter(
    (user) =>
      `${user.name} ${user.email}`.toLocaleLowerCase().includes(normalized) &&
      (status === "all" || user.active === (status === "active")),
  );
  const ordered = sort
    ? [...filtered].sort((a, b) => {
        const left = sort.key === "name" ? a.name : a.role;
        const right = sort.key === "name" ? b.name : b.role;
        return (
          left.localeCompare(right, "ko") * (sort.direction === "asc" ? 1 : -1)
        );
      })
    : filtered;
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(ordered.length / pageSize)),
  );
  const rows = ordered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  function resetSelection() {
    setPage(1);
    setSelected(new Set());
  }
  function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "")
      .trim()
      .toLowerCase();
    if (!name) {
      setFormError({ name: t("이름을 입력해 주세요.") });
      nameRef.current?.focus();
      return;
    }
    if (users.some((user) => user.email.toLowerCase() === email)) {
      setFormError({ email: t("이미 등록된 이메일입니다.") });
      emailRef.current?.focus();
      return;
    }
    setUsers((current) => [
      {
        id: crypto.randomUUID(),
        name,
        email,
        role: String(data.get("role")),
        active: true,
      },
      ...current,
    ]);
    setQuery("");
    setStatus("all");
    setSort(null);
    resetSelection();
    setAddOpen(false);
    setFormError({});
    notify(t("예제 사용자를 추가했습니다"), name);
  }
  const columns: Column<User>[] = [
    {
      key: "name",
      header: t("이름"),
      sortable: true,
      render: (user) => <strong>{user.name}</strong>,
    },
    { key: "email", header: t("이메일"), render: (user) => user.email },
    {
      key: "role",
      header: t("역할"),
      sortable: true,
      render: (user) => user.role,
    },
    {
      key: "status",
      header: t("상태"),
      render: (user) => (
        <Badge tone={user.active ? "success" : "neutral"}>
          {user.active ? t("활성") : t("비활성")}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: t("작업"),
      render: (user) => (
        <ActionMenu
          label={t(`${user.name} 작업`)}
          trigger={
            <Button
              variant="ghost"
              size="sm"
              aria-label={t(`${user.name} 작업`)}
            >
              ···
            </Button>
          }
          items={[
            {
              id: "toggle",
              label: user.active ? t("비활성화") : t("활성화"),
              onSelect: () => {
                setUsers((current) =>
                  current.map((item) =>
                    item.id === user.id
                      ? { ...item, active: !item.active }
                      : item,
                  ),
                );
                resetSelection();
                notify(t("예제 사용자 상태를 변경했습니다"), user.name);
              },
            },
          ]}
        />
      ),
    },
  ];
  return (
    <section aria-labelledby="example-table-title" className="ui-panel">
      <div className="ui-panel-header">
        <div>
          <h2 id="example-table-title">{t("사용자 목록 예제")}</h2>
          <p>{t("검색·정렬·페이지 이동·일괄 선택을 확인해 보세요.")}</p>
        </div>
        <Dialog
          title={t("예제 사용자 추가")}
          description={t("실제 계정이 생성되지는 않습니다.")}
          open={addOpen}
          onOpenChange={(open) => {
            setAddOpen(open);
            setFormError({});
          }}
          trigger={<Button>{t("사용자 추가")}</Button>}
        >
          <form onSubmit={addUser} className="ui-stack">
            <Field label={t("이름")} required error={formError.name}>
              {(props) => (
                <Input
                  {...props}
                  ref={nameRef}
                  name="name"
                  autoComplete="name"
                  maxLength={60}
                />
              )}
            </Field>
            <Field
              label={t("이메일")}
              required
              hint={t("예: new@example.test")}
              error={formError.email}
            >
              {(props) => (
                <Input
                  {...props}
                  ref={emailRef}
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                />
              )}
            </Field>
            <Field label={t("역할")} required>
              {(props) => (
                <Select {...props} name="role" defaultValue={t("조회자")}>
                  <option>{t("조회자")}</option>
                  <option>{t("관리자")}</option>
                </Select>
              )}
            </Field>
            <div className="ui-dialog-footer">
              <Button variant="secondary" onClick={() => setAddOpen(false)}>
                {t("취소")}
              </Button>
              <Button type="submit">{t("추가")}</Button>
            </div>
          </form>
        </Dialog>
      </div>
      <TableToolbar
        actions={
          <Button
            variant="ghost"
            onClick={() => {
              setQuery("");
              setStatus("all");
              setSort(null);
              resetSelection();
            }}
          >
            {t("초기화")}
          </Button>
        }
      >
        <Field label={t("사용자 검색")}>
          {(props) => (
            <Input
              {...props}
              ref={searchRef}
              type="search"
              placeholder={t("이름 또는 이메일")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                resetSelection();
              }}
            />
          )}
        </Field>
        <Field label={t("상태 필터")}>
          {(props) => (
            <Select
              {...props}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                resetSelection();
              }}
            >
              <option value="all">{t("전체 상태")}</option>
              <option value="active">{t("활성")}</option>
              <option value="inactive">{t("비활성")}</option>
            </Select>
          )}
        </Field>
      </TableToolbar>
      <div className="ui-batch-bar">
        <span role="status">
          {selected.size}
          {t("명 선택됨")}
        </span>
        <div className="ui-actions">
          <Button
            variant="ghost"
            size="sm"
            disabled={!selected.size}
            onClick={() => setSelected(new Set())}
          >
            {t("선택 해제")}
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="danger" size="sm" disabled={!selected.size}>
                {t("선택 삭제")}
              </Button>
            }
            returnFocusRef={selected.size === 0 ? searchRef : undefined}
            title={t("선택한 예제 사용자를 삭제할까요?")}
            description={t(
              `선택한 ${selected.size}명을 예제 목록에서 제거합니다. 새로고침하면 초기화됩니다.`,
            )}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            onConfirm={() => {
              const count = selected.size;
              setUsers((current) =>
                current.filter((user) => !selected.has(user.id)),
              );
              resetSelection();
              setDeleteOpen(false);
              notify(t(`${count}명의 예제 사용자를 삭제했습니다`));
            }}
          />
        </div>
      </div>
      <DataTable
        caption={t("예제 사용자 목록")}
        rows={rows}
        columns={columns}
        getRowId={(user) => user.id}
        sort={sort}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
        selection={{
          ids: selected,
          onChange: setSelected,
          label: (user) => user.name,
        }}
      />
      <Pagination
        page={currentPage}
        pageSize={pageSize}
        total={ordered.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
      <p className="ui-table-note">
        {t(
          "전체 선택은 현재 페이지에만 적용됩니다. 페이지를 이동해도 선택은 유지되며 검색·필터를 변경하면 해제됩니다.",
        )}
      </p>
    </section>
  );
}
function FormExamples({ onNotify }: { onNotify: () => void }) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(true);
  const [retried, setRetried] = useState(false);
  return (
    <div className="ui-example-grid">
      <section className="ui-panel ui-stack">
        <h2>{t("입력 컨트롤")}</h2>
        <Field
          label={t("역할 이름")}
          hint={t("담당 업무를 알 수 있는 이름을 사용하세요.")}
          required
        >
          {(props) => <Input {...props} placeholder={t("예: 운영 조회자")} />}
        </Field>
        <Field label={t("설명")}>
          {(props) => (
            <Textarea {...props} placeholder={t("권한을 부여하는 목적")} />
          )}
        </Field>
        <Field
          label={t("검증 오류 예제")}
          error={t("역할 이름은 2자 이상 입력해 주세요.")}
        >
          {(props) => <Input {...props} defaultValue="A" />}
        </Field>
        <Field label={t("비활성 필드")}>
          {(props) => (
            <Input {...props} disabled value={t("수정할 수 없는 값")} />
          )}
        </Field>
        <label className="ui-actions">
          <Checkbox defaultChecked />
          {t("선택 항목 예제")}
        </label>
        <Switch
          label={t("알림 수신")}
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
      </section>
      <section className="ui-panel ui-stack">
        <h2>{t("버튼과 상태")}</h2>
        <div className="ui-actions">
          <Button onClick={onNotify}>{t("알림 보기")}</Button>
          <Button variant="secondary" onClick={onNotify}>
            {t("보조 작업")}
          </Button>
          <Button variant="ghost" onClick={onNotify}>
            {t("텍스트 작업")}
          </Button>
          <Button loading>{t("처리 중")}</Button>
          <Button disabled>{t("비활성")}</Button>
        </div>
        <div className="ui-actions">
          <Badge tone="success">{t("승인")}</Badge>
          <Badge tone="warning">{t("대기")}</Badge>
          <Badge tone="danger">{t("거부")}</Badge>
          <Badge tone="info">{t("검토 중")}</Badge>
          <Badge>{t("미설정")}</Badge>
        </div>
        <Alert title={t("권한 요청을 검토해 주세요")} tone="warning">
          {t("변경 범위와 적용 대상을 확인할 수 있습니다.")}
        </Alert>
        <DataTable
          caption={t("오류 상태 예제")}
          rows={[]}
          columns={[]}
          getRowId={() => ""}
          error={retried ? undefined : t("목록을 불러오지 못했습니다")}
          emptyTitle={t("다시 시도했습니다")}
          emptyDescription={t("오류 상태 예제의 재시도 결과입니다.")}
          onRetry={() => setRetried(true)}
        />
        <Skeleton label={t("로딩 상태 예제")} />
        <EmptyState
          title={t("등록된 리소스가 없습니다")}
          description={t("리소스를 등록하면 이곳에 표시됩니다.")}
        />
      </section>
    </div>
  );
}
function PermissionExample() {
  const { t } = useI18n();
  const [value, setValue] = useState(new Set([permissionKey("users", "read")]));
  const [readOnly, setReadOnly] = useState(false);
  const notify = useToast();
  return (
    <section className="ui-panel ui-stack">
      <div className="ui-panel-header">
        <div>
          <h2>{t("역할별 권한 편집 예제")}</h2>
          <p>{t("행·열별 전체 선택과 일부 선택 상태를 지원합니다.")}</p>
        </div>
        <Switch
          label={t("읽기 전용")}
          checked={readOnly}
          onChange={(e) => setReadOnly(e.target.checked)}
        />
      </div>
      <PermissionMatrix
        resources={resources}
        actions={permissionActions}
        value={value}
        onChange={setValue}
        disabled={readOnly}
      />
      <div className="ui-panel-header">
        <span role="status">
          {value.size}
          {t("개 권한 선택됨")}
        </span>
        <Button
          disabled={readOnly}
          onClick={() =>
            notify(
              t("권한 선택을 확인했습니다"),
              t(`${value.size}개 선택 · 서버에 저장하지 않는 예제입니다.`),
            )
          }
        >
          {t("선택 확인")}
        </Button>
      </div>
      <Alert title={t("권한 부여 원칙")} tone="warning">
        {t(
          "업무에 필요한 최소 권한만 선택하세요. 실제 권한 부여는 서버의 검증을 거쳐야 합니다.",
        )}
      </Alert>
    </section>
  );
}
