"use client";
import type { State as WorkflowState } from "../approval-workflow/model";
import { UserPolicyAccess } from "../definition-contract/policy-ui";
import { AccessRequests } from "../approval-workflow/access-ui";
import { useMutation } from "../approval-workflow/screens";

import { useI18n } from "@/i18n/provider";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { PageHeading } from "@/components/ui/page-heading";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { DataTable } from "@/components/ui/data-table";
import { BrowseTable } from "../identity/browse-table";
import { DetailTabs } from "../identity/detail-tabs";
import { Details, Summary } from "../identity/shared";
import type { Directory } from "../platforms/model";
import { useAccess, change, rolePaths, diagnose, actionCatalog } from "./store";
import "./styles.css";
const Ref = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link className="identity-link" href={href}>
    {children}
  </Link>
);
const name = (
  rows: {
    id: string;
    name: string;
  }[],
  id: string,
) => rows.find((r) => r.id === id)?.name ?? id;
const date = (v: string) => v || "무기한";
function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="access-notice" role="status">
      {children}
    </div>
  );
}
function EditDialog({
  title,
  description,
  open,
  onClose,
  children,
  summary,
  valid,
  onApply,
}: {
  title: string;
  description: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  summary: ReactNode;
  valid: boolean;
  onApply: () => void;
}) {
  const { t } = useI18n();
  const [review, setReview] = useState(false),
    [error, setError] = useState("");
  return (
    <Dialog
      trigger={null}
      title={title}
      description={description}
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setReview(false);
          setError("");
          onClose();
        }
      }}
      size="wide"
    >
      <div className="ui-layout-stack">
        <div className="access-step">
          {review
            ? t("02 \uBCC0\uACBD \uB0B4\uC6A9 \uAC80\uD1A0")
            : t("01 \uB300\uC0C1 \uBC0F \uB0B4\uC6A9 \uC120\uD0DD")}
        </div>
        {review ? summary : children}
        {error && <p role="alert">{error}</p>}
        <div className="access-foot">
          <Button
            variant="secondary"
            onClick={() => (review ? setReview(false) : onClose())}
          >
            {review ? t("\uC774\uC804") : t("\uCDE8\uC18C")}
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              if (!review) {
                setReview(true);
                return;
              }
              try {
                onApply();
                onClose();
                setReview(false);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {review
              ? t("\uD655\uC778 \uD6C4 \uC801\uC6A9")
              : t("\uBCC0\uACBD \uB0B4\uC6A9 \uAC80\uD1A0")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
export function MemberManager({
  d,
  platformId,
}: {
  d: Directory;
  platformId: string;
}) {
  const { t } = useI18n();
  const s = useAccess(d),
    [selected, setSelected] = useState(new Set<string>()),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [operation, setOperation] = useState(""),
    [reason, setReason] = useState(""),
    [addIds, setAddIds] = useState<string[]>([]),
    [message, setMessage] = useState("");
  const members = s.directory.members.filter(
      (m) => m.platformId === platformId,
    ),
    visible = members.filter(
      (m) =>
        (!status || m.status === status) &&
        `${m.name} ${m.email}`.toLowerCase().includes(query.toLowerCase()),
    );
  const chosen = members.filter((m) => selected.has(m.userId));
  const candidates = s.directory.users.filter(
    (u) => !members.some((m) => m.userId === u.id),
  );
  const labels: Record<string, string> = {
    add: t("\uBA64\uBC84 \uCD94\uAC00"),
    active: t("\uD65C\uC131\uD654"),
    suspended: t("\uC911\uC9C0"),
    remove: t("\uBA64\uBC84 \uC81C\uC678"),
  };
  function open(op: string) {
    setOperation(op);
    setReason("");
    setAddIds([]);
  }
  return (
    <div className="ui-layout-stack">
      <Summary
        items={[
          { label: t("\uC804\uCCB4 \uBA64\uBC84"), value: members.length },
          {
            label: t("\uD65C\uC131"),
            value: members.filter((m) => m.status === "active").length,
          },
          {
            label: t("\uC911\uC9C0"),
            value: members.filter((m) => m.status === "suspended").length,
          },
        ]}
      />
      {message && <Notice>{message}</Notice>}
      <div className="access-toolbar">
        <Field label={t("\uBA64\uBC84 \uAC80\uC0C9")}>
          {(p) => (
            <Input
              {...p}
              placeholder={t(
                "\uB2C9\uB124\uC784 \uB610\uB294 \uC774\uBA54\uC77C",
              )}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
        </Field>
        <Field label={t("\uBA64\uBC84 \uC0C1\uD0DC")}>
          {(p) => (
            <Select
              {...p}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">{t("\uC804\uCCB4 \uC0C1\uD0DC")}</option>
              <option value="active">{t("\uD65C\uC131")}</option>
              <option value="suspended">{t("\uC911\uC9C0")}</option>
            </Select>
          )}
        </Field>
        <Button onClick={() => open("add")}>
          {t("\uBA64\uBC84 \uCD94\uAC00")}
        </Button>
      </div>
      <div className="access-row">
        <p className="access-note">
          {t("\uC120\uD0DD")}
          {selected.size}
          {t(
            "\uBA85 \u00B7 \uAC80\uC0C9\u00B7\uD544\uD130 \uBCC0\uACBD \uC2DC\uC5D0\uB3C4 \uC120\uD0DD\uC744 \uC720\uC9C0\uD569\uB2C8\uB2E4.",
          )}
        </p>
        <div className="access-actions">
          <Button
            size="sm"
            variant="secondary"
            disabled={
              !chosen.length || chosen.every((m) => m.status === "active")
            }
            onClick={() => open("active")}
          >
            {t("\uD65C\uC131\uD654")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={
              !chosen.length || chosen.every((m) => m.status === "suspended")
            }
            onClick={() => open("suspended")}
          >
            {t("\uC911\uC9C0")}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={!chosen.length}
            onClick={() => open("remove")}
          >
            {t("\uBA64\uBC84 \uC81C\uC678")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!selected.size}
            onClick={() => setSelected(new Set())}
          >
            {t("\uC120\uD0DD \uD574\uC81C")}
          </Button>
        </div>
      </div>
      <DataTable
        caption={t("\uD50C\uB7AB\uD3FC \uBA64\uBC84 \uAD00\uB9AC")}
        rows={visible}
        getRowId={(m) => m.userId}
        selection={{
          ids: selected,
          onChange: setSelected,
          label: (m) => m.name,
        }}
        columns={[
          {
            key: "name",
            header: t("\uBA64\uBC84"),
            render: (m) => (
              <>
                <Ref href={`/platforms/${platformId}/members/${m.id}`}>
                  {m.name}
                </Ref>
                <div className="access-small">{m.email}</div>
              </>
            ),
          },
          {
            key: "status",
            header: t("\uBA64\uBC84 \uC0C1\uD0DC"),
            render: (m) => (
              <Badge tone={m.status === "active" ? "success" : "neutral"}>
                {m.status === "active" ? t("\uD65C\uC131") : t("\uC911\uC9C0")}
              </Badge>
            ),
          },
          {
            key: "roles",
            header: t("\uD50C\uB7AB\uD3FC \uC5ED\uD560"),
            render: (m) => {
              const roles = rolePaths(s, m.userId).filter(
                (p) => p.role.platformId === platformId,
              );
              return (
                <Ref href={`/users/${m.userId}?tab=access`}>
                  {new Set(roles.map((p) => p.role.id)).size}
                  {t("\uAC1C \uC5ED\uD560 \uBCF4\uAE30")}
                </Ref>
              );
            },
          },
          {
            key: "access",
            header: t("\uAD8C\uD55C \uD655\uC778"),
            render: (m) => (
              <Ref
                href={`/access-check?user=${m.userId}&platform=${platformId}`}
              >
                {t("\uC811\uADFC \uD655\uC778")}
              </Ref>
            ),
          },
        ]}
      />
      {operation && (
        <EditDialog
          key={operation}
          title={labels[operation]}
          description={`${name(s.directory.platforms, platformId)} 플랫폼의 멤버십을 관리합니다.`}
          open
          onClose={() => setOperation("")}
          valid={
            (operation === "add" ? addIds.length > 0 : chosen.length > 0) &&
            reason.trim().length > 0
          }
          onApply={() => {
            change(s.revision, (n) => {
              if (operation === "add")
                for (const id of addIds) {
                  const u = n.directory.users.find((u) => u.id === id)!;
                  n.directory.members.push({
                    ...u,
                    id: `member-${id}`,
                    userId: id,
                    platformId,
                    status: "active",
                  });
                }
              else if (operation === "remove")
                n.directory.members = n.directory.members.filter(
                  (m) => m.platformId !== platformId || !selected.has(m.userId),
                );
              else
                for (const m of n.directory.members)
                  if (m.platformId === platformId && selected.has(m.userId))
                    m.status = operation as "active" | "suspended";
            });
            setMessage(
              `${labels[operation]} 완료 · ${operation === "add" ? addIds.length : chosen.length}명`,
            );
            setSelected(new Set());
          }}
          summary={
            <div className="ui-layout-stack">
              <Details
                items={[
                  {
                    label: t("\uD50C\uB7AB\uD3FC"),
                    value: name(s.directory.platforms, platformId),
                  },
                  { label: t("\uBCC0\uACBD"), value: labels[operation] },
                  {
                    label: t("\uB300\uC0C1"),
                    value:
                      operation === "add"
                        ? addIds
                            .map((id) => name(s.directory.users, id))
                            .join(", ")
                        : chosen.map((m) => m.name).join(", "),
                  },
                  { label: t("\uC0AC\uC720"), value: reason },
                ]}
              />
              <Notice>
                {operation === "remove"
                  ? t(
                      "\uC774 \uD50C\uB7AB\uD3FC\uC758 \uBA64\uBC84\uC2ED\uC744 \uC81C\uC678\uD569\uB2C8\uB2E4. \uC0AC\uC6A9\uC790 \uCE74\uD0C8\uB85C\uADF8\u00B7\uB2E4\uB978 \uD50C\uB7AB\uD3FC \uBA64\uBC84\uC2ED\u00B7\uAE30\uC874 \uC5ED\uD560 \uBD80\uC5EC\uB294 \uC720\uC9C0\uD569\uB2C8\uB2E4.",
                    )
                  : operation === "suspended"
                    ? t(
                        "\uBA64\uBC84\uC2ED\uC744 \uC911\uC9C0\uD569\uB2C8\uB2E4. \uC5ED\uD560 \uBD80\uC5EC\uB294 \uC720\uC9C0\uD558\uBA70 \uC7AC\uD65C\uC131\uD654 \uC2DC \uB2E4\uC2DC \uD3C9\uAC00\uD569\uB2C8\uB2E4.",
                      )
                    : t(
                        "\uB2E4\uB978 \uD50C\uB7AB\uD3FC\uACFC \uAE30\uC874 \uC5ED\uD560 \uBD80\uC5EC\uB294 \uBCC0\uACBD\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
                      )}
              </Notice>
            </div>
          }
        >
          {operation === "add" ? (
            <div className="access-select-list">
              {candidates.map((u) => (
                <label className="access-option" key={u.id}>
                  <input
                    type="checkbox"
                    checked={addIds.includes(u.id)}
                    onChange={(e) =>
                      setAddIds(
                        e.target.checked
                          ? [...addIds, u.id]
                          : addIds.filter((id) => id !== u.id),
                      )
                    }
                  />
                  <span>
                    {u.name}
                    <small>{u.email}</small>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p>
              {chosen.map((m) => m.name).join(", ")} · {chosen.length}
              {t("\uBA85")}
            </p>
          )}
          <Field label={t("\uBCC0\uACBD \uC0AC\uC720")} required>
            {(p) => (
              <Textarea
                {...p}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t(
                  "\uBCC0\uACBD \uC0AC\uC720\uB97C \uC785\uB825\uD558\uC138\uC694",
                )}
              />
            )}
          </Field>
        </EditDialog>
      )}
    </div>
  );
}
export function RoleEditor({ d, roleId }: { d: Directory; roleId?: string }) {
  const { t } = useI18n();
  const s = useAccess(d),
    router = useRouter(),
    role = s.directory.roles.find((r) => r.id === roleId),
    [open, setOpen] = useState(false),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [platform, setPlatform] = useState("orion");
  return (
    <>
      <Button
        variant={role ? "secondary" : "primary"}
        onClick={() => {
          setTitle(role?.name ?? "");
          setDescription(role?.description ?? "");
          setPlatform(role?.platformId ?? "orion");
          setOpen(true);
        }}
      >
        {role
          ? t("\uC5ED\uD560 \uC815\uBCF4 \uC218\uC815")
          : t("\uC5ED\uD560 \uC0DD\uC131")}
      </Button>
      {open && (
        <EditDialog
          title={
            role
              ? t("\uC5ED\uD560 \uC815\uBCF4 \uC218\uC815")
              : t("\uC5ED\uD560 \uC0DD\uC131")
          }
          description={t(
            "\uC5ED\uD560\uC758 \uD50C\uB7AB\uD3FC\uACFC \uC5C5\uBB34 \uBAA9\uC801\uC744 \uBA85\uD655\uD788 \uC9C0\uC815\uD569\uB2C8\uB2E4.",
          )}
          open
          onClose={() => setOpen(false)}
          valid={
            !!title.trim() &&
            !!description.trim() &&
            !s.directory.roles.some(
              (r) =>
                r.id !== roleId &&
                r.platformId === platform &&
                r.name === title.trim(),
            )
          }
          summary={
            <Details
              items={[
                {
                  label: t("\uD50C\uB7AB\uD3FC"),
                  value: name(s.directory.platforms, platform),
                },
                { label: t("\uC5ED\uD560"), value: title },
                { label: t("\uC124\uBA85"), value: description },
              ]}
            />
          }
          onApply={() => {
            const id = roleId ?? `role-custom-${s.revision + 1}`;
            change(s.revision, (n) => {
              if (role) {
                const r = n.directory.roles.find((r) => r.id === roleId)!;
                r.name = title.trim();
                r.description = description.trim();
              } else
                n.directory.roles.push({
                  id,
                  platformId: platform,
                  name: title.trim(),
                  description: description.trim(),
                  policyIds: [],
                });
            });
            router.push(`/roles/${id}`);
          }}
        >
          <Field label={t("\uD50C\uB7AB\uD3FC")}>
            {(p) => (
              <Select
                {...p}
                value={platform}
                disabled={!!role}
                onChange={(e) => setPlatform(e.target.value)}
              >
                {s.directory.platforms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label={t("\uC5ED\uD560 \uC774\uB984")}
            required
            hint={t(
              "\uAC19\uC740 \uD50C\uB7AB\uD3FC \uC548\uC5D0\uC11C \uC911\uBCF5\uB418\uC9C0 \uC54A\uB294 \uC774\uB984",
            )}
          >
            {(p) => (
              <Input
                {...p}
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            )}
          </Field>
          <Field label={t("\uC124\uBA85")} required>
            {(p) => (
              <Textarea
                {...p}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </Field>
        </EditDialog>
      )}
    </>
  );
}
export function RoleManager({ d, id }: { d: Directory; id: string }) {
  const { t } = useI18n();
  const s = useAccess(d),
    r = s.directory.roles.find((r) => r.id === id),
    [edit, setEdit] = useState(""),
    [ids, setIds] = useState<string[]>([]),
    [expiry, setExpiry] = useState<Record<string, string>>({}),
    [message, setMessage] = useState("");
  if (!r)
    return (
      <PageHeading
        title={t(
          "\uC5ED\uD560\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4",
        )}
        description={t(
          "\uC5ED\uD560 \uBAA9\uB85D\uC5D0\uC11C \uB2E4\uC2DC \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.",
        )}
      />
    );
  const users = s.directory.userRoles
    .filter((a) => a.platformId === r.platformId && a.roleIds.includes(id))
    .map((a) => s.directory.users.find((u) => u.id === a.userId)!);
  const orgs = s.directory.organizations.filter(
    (o) => o.platformId === r.platformId && o.roleIds.includes(id),
  );
  const policies = s.bindings
    .filter((b) => b.roleId === id)
    .map((b) => ({
      ...b,
      id: b.policyId,
      name: name(s.directory.policies, b.policyId),
    }));
  const candidates =
    edit === "users"
      ? s.directory.users
      : edit === "organizations"
        ? s.directory.organizations.filter((o) => o.platformId === r.platformId)
        : s.directory.policies.filter((p) =>
            r.platformId === "finance"
              ? p.id === "policy-settlement"
              : p.id !== "policy-settlement",
          );
  const labels: Record<string, string> = {
    users: t("\uC0AC\uC6A9\uC790 \uBD80\uC5EC \uAD00\uB9AC"),
    organizations: t("\uC870\uC9C1 \uBD80\uC5EC \uAD00\uB9AC"),
    policies: t("\uC815\uCC45 \uBC0F \uB9CC\uB8CC \uAD00\uB9AC"),
  };
  function start(kind: string) {
    setIds(
      kind === "users"
        ? users.map((u) => u.id)
        : kind === "organizations"
          ? orgs.map((o) => o.id)
          : policies.map((p) => p.id),
    );
    setExpiry(Object.fromEntries(policies.map((p) => [p.id, p.expiresAt])));
    setEdit(kind);
  }
  const oldIds =
    edit === "users"
      ? users.map((u) => u.id)
      : edit === "organizations"
        ? orgs.map((o) => o.id)
        : policies.map((p) => p.id);
  return (
    <div className="ui-layout-stack">
      <Breadcrumbs
        items={[
          { label: t("\uC5ED\uD560"), href: "/roles" },
          { label: r.name },
        ]}
      />
      <PageHeading
        title={r.name}
        description={r.description}
        actions={<RoleEditor d={d} roleId={id} />}
      />
      <section className="ui-panel access-card" data-detail-summary>
        <Details
          items={[
            {
              label: t("\uD50C\uB7AB\uD3FC"),
              value: name(s.directory.platforms, r.platformId),
            },
            { label: t("\uC5ED\uD560 ID"), value: id },
            {
              label: t("\uAD00\uB9AC \uBC29\uC2DD"),
              value: t("\uD50C\uB7AB\uD3FC \uC5ED\uD560"),
            },
          ]}
        />
      </section>
      {message && <Notice>{message}</Notice>}
      <DetailTabs
        items={[
          {
            value: "users",
            label: `${t("사용자")} (${users.length})`,
            content: (
              <div className="ui-layout-stack">
                <div className="access-row">
                  <p className="access-note">
                    {t(
                      "\uC5ED\uD560 \uBD80\uC5EC\uC640 \uD50C\uB7AB\uD3FC \uBA64\uBC84\uC2ED\uC740 \uBCC4\uB3C4\uB85C \uAD00\uB9AC\uD569\uB2C8\uB2E4.",
                    )}
                  </p>
                  <Button onClick={() => start("users")}>
                    {t("\uC0AC\uC6A9\uC790 \uBD80\uC5EC \uAD00\uB9AC")}
                  </Button>
                </div>
                <BrowseTable
                  title={t("\uC5ED\uD560 \uC0AC\uC6A9\uC790")}
                  rows={users}
                  searchText={(u) => u.name + u.email}
                  sortValue={(u) => u.name}
                  columns={[
                    {
                      key: "name",
                      header: t("\uC0AC\uC6A9\uC790"),
                      render: (u) => (
                        <Ref href={`/users/${u.id}?tab=access`}>{u.name}</Ref>
                      ),
                    },
                    {
                      key: "email",
                      header: t("\uC774\uBA54\uC77C"),
                      render: (u) => u.email,
                    },
                    {
                      key: "status",
                      header: t("\uBA64\uBC84\uC2ED"),
                      render: (u) => (
                        <Badge>
                          {s.directory.members.find(
                            (m) =>
                              m.userId === u.id &&
                              m.platformId === r.platformId,
                          )?.status === "active"
                            ? t("\uD65C\uC131")
                            : t("\uC911\uC9C0 / \uBBF8\uAC00\uC785")}
                        </Badge>
                      ),
                    },
                  ]}
                />
              </div>
            ),
          },
          {
            value: "organizations",
            label: `${t("조직")} (${orgs.length})`,
            content: (
              <div className="ui-layout-stack">
                <div className="access-row">
                  <p className="access-note">
                    {t(
                      "\uD574\uB2F9 \uD50C\uB7AB\uD3FC\uC758 \uD65C\uC131 \uBA64\uBC84\uC778 \uC870\uC9C1\uC6D0\uC5D0\uAC8C \uC801\uC6A9\uD569\uB2C8\uB2E4.",
                    )}
                  </p>
                  <Button onClick={() => start("organizations")}>
                    {t("\uC870\uC9C1 \uBD80\uC5EC \uAD00\uB9AC")}
                  </Button>
                </div>
                <BrowseTable
                  title={t("\uC5ED\uD560 \uC870\uC9C1")}
                  rows={orgs}
                  searchText={(o) => o.name}
                  sortValue={(o) => o.name}
                  columns={[
                    {
                      key: "name",
                      header: t("\uC870\uC9C1"),
                      render: (o) => (
                        <Ref href={`/organizations/${o.id}`}>{o.name}</Ref>
                      ),
                    },
                    {
                      key: "scope",
                      header: t("\uC801\uC6A9 \uBC94\uC704"),
                      render: () => name(s.directory.platforms, r.platformId),
                    },
                  ]}
                />
              </div>
            ),
          },
          ...(r.platformId === "orion"
            ? [
                {
                  value: "service-accounts",
                  label: `${t("서비스 어카운트")} (${s.directory.accounts.filter((a) => a.roleIds.includes(id)).length})`,
                  content: (
                    <BrowseTable
                      title={t(
                        "\uC5ED\uD560 \uC11C\uBE44\uC2A4 \uC5B4\uCE74\uC6B4\uD2B8",
                      )}
                      rows={s.directory.accounts.filter((a) =>
                        a.roleIds.includes(id),
                      )}
                      searchText={(a) => a.name}
                      sortValue={(a) => a.name}
                      columns={[
                        {
                          key: "name",
                          header: t(
                            "\uC11C\uBE44\uC2A4 \uC5B4\uCE74\uC6B4\uD2B8",
                          ),
                          render: (a) => (
                            <Ref href={`/service-accounts/${a.id}?tab=roles`}>
                              {a.name}
                            </Ref>
                          ),
                        },
                      ]}
                    />
                  ),
                },
              ]
            : []),
          {
            value: "policies",
            label: `${t("정책")} (${policies.length})`,
            content: (
              <div className="ui-layout-stack">
                <div className="access-row">
                  <p className="access-note">
                    {t(
                      "\uB9CC\uB8CC\uB294 \uC774 \uC5ED\uD560\uACFC \uC815\uCC45 \uC0AC\uC774\uC758 \uAD00\uACC4\uC5D0\uB9CC \uC801\uC6A9\uB429\uB2C8\uB2E4.",
                    )}
                  </p>
                  <Button onClick={() => start("policies")}>
                    {t("\uC815\uCC45 \uBC0F \uB9CC\uB8CC \uAD00\uB9AC")}
                  </Button>
                </div>
                <BrowseTable
                  title={t("\uC5ED\uD560 \uC815\uCC45")}
                  rows={policies}
                  searchText={(p) => p.name}
                  sortValue={(p) => p.name}
                  columns={[
                    {
                      key: "name",
                      header: t("\uC815\uCC45"),
                      render: (p) => (
                        <Ref href={`/policies/${p.id}`}>{p.name}</Ref>
                      ),
                    },
                    {
                      key: "effect",
                      header: t("\uD6A8\uACFC"),
                      render: () => <Badge>{t("\uD5C8\uC6A9")}</Badge>,
                    },
                    {
                      key: "expiry",
                      header: t("\uBD80\uC5EC \uB9CC\uB8CC\uC77C"),
                      render: (p) => date(p.expiresAt),
                    },
                    {
                      key: "actions",
                      header: t("\uC811\uADFC \uBC94\uC704"),
                      render: (p) =>
                        actionCatalog
                          .filter((a) => a.policyIds.includes(p.id))
                          .map((a) => a.name)
                          .join(", ") ||
                        t("\uC815\uCC45 \uC0C1\uC138\uC5D0\uC11C \uD655\uC778"),
                    },
                  ]}
                />
              </div>
            ),
          },
        ]}
      />
      {edit && (
        <EditDialog
          title={labels[edit]}
          description={`${name(s.directory.platforms, r.platformId)} · ${r.name}`}
          open
          onClose={() => setEdit("")}
          valid={ids.every(
            (i) =>
              !expiry[i] || expiry[i] >= new Date().toISOString().slice(0, 10),
          )}
          summary={
            <div className="ui-layout-stack">
              <Details
                items={[
                  {
                    label: t("\uCD94\uAC00"),
                    value:
                      ids
                        .filter((i) => !oldIds.includes(i))
                        .map((i) => name(candidates, i))
                        .join(", ") || t("\uC5C6\uC74C"),
                  },
                  {
                    label: t("\uD574\uC81C"),
                    value:
                      oldIds
                        .filter((i) => !ids.includes(i))
                        .map((i) => name(candidates, i))
                        .join(", ") || t("\uC5C6\uC74C"),
                  },
                  {
                    label: t("\uC720\uC9C0"),
                    value:
                      ids
                        .filter((i) => oldIds.includes(i))
                        .map((i) => name(candidates, i))
                        .join(", ") || t("\uC5C6\uC74C"),
                  },
                ]}
              />
              {edit === "policies" &&
                ids.map((i) => (
                  <p key={i}>
                    {name(candidates, i)}
                    {t("\u00B7 \uB9CC\uB8CC")}
                    {date(expiry[i])}
                  </p>
                ))}
              <Notice>
                {t(
                  "\uB2E4\uB978 \uC5ED\uD560\uC758 \uBD80\uC5EC\uC640 \uD50C\uB7AB\uD3FC \uBA64\uBC84\uC2ED\uC740 \uC720\uC9C0\uD569\uB2C8\uB2E4. \uD574\uC81C \uD6C4\uC5D0\uB3C4 \uB2E4\uB978 \uACBD\uB85C\uB85C \uAD8C\uD55C\uC774 \uB0A8\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
                )}
              </Notice>
            </div>
          }
          onApply={() => {
            change(s.revision, (n) => {
              if (edit === "users") {
                n.directory.userRoles = n.directory.userRoles.map((a) =>
                  a.platformId === r.platformId
                    ? { ...a, roleIds: a.roleIds.filter((v) => v !== id) }
                    : a,
                );
                for (const userId of ids) {
                  const a = n.directory.userRoles.find(
                    (a) => a.userId === userId && a.platformId === r.platformId,
                  );
                  if (a) a.roleIds.push(id);
                  else
                    n.directory.userRoles.push({
                      userId,
                      platformId: r.platformId,
                      roleIds: [id],
                    });
                }
              } else if (edit === "organizations") {
                for (const o of n.directory.organizations)
                  if (o.platformId === r.platformId)
                    o.roleIds = [
                      ...o.roleIds.filter((v) => v !== id),
                      ...(ids.includes(o.id) ? [id] : []),
                    ];
              } else {
                n.bindings = [
                  ...n.bindings.filter((b) => b.roleId !== id),
                  ...ids.map((policyId) => ({
                    roleId: id,
                    policyId,
                    expiresAt: expiry[policyId] ?? "",
                  })),
                ];
                n.directory.roles.find((r) => r.id === id)!.policyIds = ids;
              }
            });
            setMessage(`${labels[edit]} 내용을 적용했습니다.`);
          }}
        >
          <div className="access-select-list">
            {candidates.map((c) => (
              <div className="access-option" key={c.id}>
                <label>
                  <input
                    type="checkbox"
                    aria-label={c.name}
                    checked={ids.includes(c.id)}
                    onChange={(e) =>
                      setIds(
                        e.target.checked
                          ? [...ids, c.id]
                          : ids.filter((i) => i !== c.id),
                      )
                    }
                  />{" "}
                  {c.name}
                </label>
                {edit === "policies" && ids.includes(c.id) && (
                  <Field
                    label={`${c.name} 만료일`}
                    hint={t("\uBE44\uC6CC \uB450\uBA74 \uBB34\uAE30\uD55C")}
                  >
                    {(p) => (
                      <Input
                        {...p}
                        type="date"
                        min={new Date().toISOString().slice(0, 10)}
                        value={expiry[c.id] ?? ""}
                        onChange={(e) =>
                          setExpiry({ ...expiry, [c.id]: e.target.value })
                        }
                      />
                    )}
                  </Field>
                )}
              </div>
            ))}
          </div>
        </EditDialog>
      )}
    </div>
  );
}
export function AccessSummary({
  d,
  userId,
  own = false,
  workflow,
}: {
  d: Directory;
  userId: string;
  own?: boolean;
  workflow?: WorkflowState;
}) {
  const { t } = useI18n();
  const s = useAccess(d, workflow),
    [platform, setPlatform] = useState("");
  const paths = rolePaths(s, userId).filter(
    (p) => !platform || p.role.platformId === platform,
  );
  const user = s.directory.users.find((u) => u.id === userId);
  if (!user)
    return (
      <p role="alert">
        {t(
          "\uC0AC\uC6A9\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.",
        )}
      </p>
    );
  const actions = actionCatalog.filter(
    (a) => !platform || a.platformId === platform,
  );
  return (
    <div className="ui-layout-stack">
      <div className="access-toolbar">
        <Field label={t("\uC870\uD68C \uD50C\uB7AB\uD3FC")}>
          {(p) => (
            <Select
              {...p}
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              <option value="">{t("\uBAA8\uB4E0 \uD50C\uB7AB\uD3FC")}</option>
              {s.directory.platforms.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {!own && (
          <Ref
            href={`/access-check?user=${userId}${platform ? `&platform=${platform}` : ""}`}
          >
            {t("\uC811\uADFC \uAC00\uB2A5 \uC5EC\uBD80 \uD655\uC778 \u2192")}
          </Ref>
        )}
      </div>
      <BrowseTable
        title={t("권한 목록")}
        rows={[...new Map(paths.map((p) => [p.role.id, p.role])).values()]}
        searchText={(r) => r.name}
        sortValue={(r) => r.name}
        columns={[
          {
            key: "role",
            header: t("역할"),
            render: (r) => <Ref href={`/roles/${r.id}`}>{r.name}</Ref>,
          },
          {
            key: "platform",
            header: t("플랫폼"),
            render: (r) => name(s.directory.platforms, r.platformId),
          },
          {
            key: "source",
            header: t("부여 방식"),
            render: (r) =>
              [
                ...new Set(
                  paths.filter((p) => p.role.id === r.id).map((p) => p.source),
                ),
              ].join(", "),
          },
        ]}
      />
      <BrowseTable
        title={t("가능한 업무")}
        rows={actions.filter((a) => diagnose(s, userId, a.id).allowed)}
        searchText={(a) => a.name}
        sortValue={(a) => a.name}
        columns={[
          { key: "name", header: t("업무"), render: (a) => a.name },
          {
            key: "platform",
            header: t("플랫폼"),
            render: (a) => name(s.directory.platforms, a.platformId),
          },
        ]}
      />
    </div>
  );
}
export function AccessCheck({ d, actorId }: { d: Directory; actorId: string }) {
  const { t } = useI18n();
  const s = useAccess(d),
    params = useSearchParams(),
    [user, setUser] = useState(params.get("user") ?? actorId),
    [platform, setPlatform] = useState(params.get("platform") ?? "orion"),
    [action, setAction] = useState(params.get("action") ?? "identity~read-hr"),
    [result, setResult] = useState<ReturnType<typeof diagnose> | null>(null),
    [version, setVersion] = useState(-1);
  const target = actionCatalog.find(
    (a) => a.id === action && a.platformId === platform,
  );
  function clear() {
    setResult(null);
  }
  return (
    <div className="ui-layout-stack">
      <PageHeading
        title={t("\uC811\uADFC \uAC00\uB2A5 \uC5EC\uBD80 \uD655\uC778")}
        description={t(
          "\uB204\uAC00 \uC5B4\uB5A4 \uC5C5\uBB34\uC5D0 \uC811\uADFC\uD560 \uC218 \uC788\uB294\uC9C0 \uD655\uC778\uD558\uACE0, \uBD80\uC5EC \uACBD\uB85C\uC640 \uC81C\uD55C \uC0AC\uC720\uB97C \uC0B4\uD3B4\uBD05\uB2C8\uB2E4.",
        )}
      />
      <section className="ui-panel access-card">
        <div className="access-toolbar">
          <Field label={t("\uC0AC\uC6A9\uC790")}>
            {(p) => (
              <Select
                {...p}
                value={user}
                onChange={(e) => {
                  setUser(e.target.value);
                  clear();
                }}
              >
                {s.directory.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.email}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("\uD50C\uB7AB\uD3FC")}>
            {(p) => (
              <Select
                {...p}
                value={platform}
                onChange={(e) => {
                  setPlatform(e.target.value);
                  setAction("");
                  clear();
                }}
              >
                {s.directory.platforms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("\uB300\uC0C1 Action")}>
            {(p) => (
              <Select
                {...p}
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  clear();
                }}
              >
                <option value="">{t("Action \uC120\uD0DD")}</option>
                {actionCatalog
                  .filter((a) => a.platformId === platform)
                  .map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.name}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
          <Button
            disabled={!target || !s.directory.users.some((u) => u.id === user)}
            onClick={() => {
              setResult(diagnose(s, user, action));
              setVersion(s.revision);
            }}
          >
            {t("\uC811\uADFC \uD655\uC778")}
          </Button>
        </div>
      </section>
      {result && target ? (
        <>
          <section className="access-result" aria-live="polite">
            <p className="access-kicker">ACCESS DECISION</p>
            <Badge tone={result.allowed ? "success" : "danger"}>
              {result.allowed
                ? t("\uC811\uADFC \uD5C8\uC6A9")
                : t("\uC811\uADFC \uAC70\uBD80")}
            </Badge>
            <h2>
              {name(s.directory.users, user)} · {target.name}
            </h2>
            <p>{result.reason}</p>
            <p className="access-small">{target.endpoint}</p>
            {version !== s.revision && (
              <p role="alert">
                {t(
                  "\uAD8C\uD55C \uC815\uBCF4\uAC00 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694.",
                )}
              </p>
            )}
          </section>
          <details className="ui-panel">
            <summary>{t("상세 근거 및 데이터 범위")}</summary>
            <div className="ui-disclosure-body ui-layout-stack">
              <div className="access-grid">
                <section className="ui-panel access-card">
                  <h2>{t("\uD310\uC815 \uADFC\uAC70")}</h2>
                  <Details
                    items={[
                      {
                        label: t("\uBA64\uBC84\uC2ED"),
                        value:
                          s.directory.members.find(
                            (m) =>
                              m.userId === user && m.platformId === platform,
                          )?.status === "active"
                            ? t("\uD65C\uC131")
                            : t("\uC911\uC9C0 \uB610\uB294 \uBBF8\uAC00\uC785"),
                      },
                      {
                        label: t("\uC720\uD6A8 \uBD80\uC5EC \uACBD\uB85C"),
                        value: `${result.paths.filter((p) => !p.expired).length}개`,
                      },
                      {
                        label: t("\uD655\uC778 \uB300\uC0C1"),
                        value: target.name,
                      },
                    ]}
                  />
                </section>
                <section className="ui-panel access-card">
                  <h2>{t("\uC751\uB2F5 \uB370\uC774\uD130 \uBC94\uC704")}</h2>
                  <p>
                    {result.allowed
                      ? target.fields
                      : t(
                          "\uC811\uADFC\uC774 \uAC70\uBD80\uB418\uC5B4 \uBC18\uD658 \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
                        )}
                  </p>
                  <p className="access-note">
                    {t(
                      "\uC815\uCC45\uC5D0 \uC9C0\uC815\uB41C \uD544\uB4DC\uC640 \uB9C8\uC2A4\uD0B9 \uBC94\uC704\uB97C \uD655\uC778\uD569\uB2C8\uB2E4.",
                    )}
                  </p>
                </section>
              </div>
              <section className="ui-panel access-card">
                <h2>{t("\uC5ED\uD560\uACFC \uC815\uCC45 \uACBD\uB85C")}</h2>
                {result.paths.length ? (
                  result.paths.map((p) => (
                    <div
                      key={p.id + p.binding.policyId}
                      className="access-path"
                    >
                      <p>
                        {p.source} →{" "}
                        <Ref href={`/roles/${p.role.id}`}>{p.role.name}</Ref> →{" "}
                        {name(s.directory.policies, p.binding.policyId)} →{" "}
                        {target.name}
                      </p>
                      <p>
                        {t("\uBD80\uC5EC \uB9CC\uB8CC:")}
                        {date(p.binding.expiresAt)}{" "}
                        {p.expired ? t("\u00B7 \uB9CC\uB8CC\uB428") : ""}
                      </p>
                    </div>
                  ))
                ) : (
                  <p>
                    {t(
                      "\uC5F0\uACB0\uB41C \uBD80\uC5EC \uACBD\uB85C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uD544\uC694\uD55C \uC5ED\uD560\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.",
                    )}
                  </p>
                )}
                <Ref href={`/users/${user}?tab=access`}>
                  {t(
                    "\uC0AC\uC6A9\uC790 \uAD8C\uD55C \uC885\uD569 \uC870\uD68C \u2192",
                  )}
                </Ref>
              </section>
            </div>
          </details>
        </>
      ) : (
        <div className="access-empty">
          {t(
            "\uC0AC\uC6A9\uC790\uC640 \uC5C5\uBB34\uB97C \uC120\uD0DD\uD55C \uB4A4 \uC811\uADFC \uD655\uC778\uC744 \uB20C\uB7EC \uC8FC\uC138\uC694.",
          )}
        </div>
      )}
    </div>
  );
}
export function AccessRequestForm({
  d,
  actorId,
  workflow,
}: {
  d: Directory;
  actorId: string;
  workflow: WorkflowState;
}) {
  const { t } = useI18n();
  const mutation = useMutation(workflow);
  const [requestId] = useState(() => crypto.randomUUID());
  const s = useAccess(d, workflow),
    params = useSearchParams(),
    router = useRouter(),
    [platform, setPlatform] = useState(params.get("platform") ?? "orion"),
    [roleId, setRoleId] = useState(params.get("role") ?? ""),
    [reason, setReason] = useState(""),
    [expires, setExpires] = useState(""),
    [review, setReview] = useState(false);
  const role = s.directory.roles.find(
      (r) => r.id === roleId && r.platformId === platform,
    ),
    held = rolePaths(s, actorId).some((p) => p.role.id === roleId),
    pending = workflow.documents.some(
      (r) =>
        r.requesterId === actorId &&
        r.access?.platformId === platform &&
        r.access?.roleId === roleId &&
        (r.status === "pending" ||
          (r.status === "approved" && r.execution !== "completed")),
    );
  const valid =
    !!role &&
    workflow.templates.some((t) => t.type === "access") &&
    s.directory.members.some(
      (m) =>
        m.userId === actorId &&
        m.platformId === platform &&
        m.status === "active",
    ) &&
    !held &&
    !pending &&
    reason.trim().length > 0 &&
    (!expires || expires >= new Date().toISOString().slice(0, 10));
  return (
    <div className="ui-layout-stack access-form">
      <Breadcrumbs
        items={[
          { label: t("\uB0B4 \uC811\uADFC \uAD8C\uD55C"), href: "/my-access" },
          { label: t("\uAD8C\uD55C \uC2E0\uCCAD") },
        ]}
      />
      <PageHeading
        title={t("\uAD8C\uD55C \uC2E0\uCCAD")}
        description={t(
          "\uC5C5\uBB34\uC5D0 \uD544\uC694\uD55C \uD50C\uB7AB\uD3FC \uC5ED\uD560\uACFC \uC0AC\uC6A9 \uAE30\uAC04\uC744 \uC120\uD0DD\uD574 \uC2E0\uCCAD\uD569\uB2C8\uB2E4.",
        )}
      />
      <section className="ui-panel access-card">
        <div className="access-person">
          <div className="access-avatar">
            {name(s.directory.users, actorId).slice(0, 1)}
          </div>
          <div>
            <strong>{name(s.directory.users, actorId)}</strong>
            <p className="access-note">
              {s.directory.users.find((u) => u.id === actorId)?.email}
              {t("\u00B7 \uC2E0\uCCAD\uC790")}
            </p>
          </div>
        </div>
      </section>
      <section className="ui-panel access-card ui-layout-stack">
        <p className="access-kicker">01 REQUEST DETAILS</p>
        <Field label={t("\uD50C\uB7AB\uD3FC")} required>
          {(p) => (
            <Select
              {...p}
              value={platform}
              onChange={(e) => {
                setPlatform(e.target.value);
                setRoleId("");
              }}
            >
              {s.directory.platforms.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("\uC2E0\uCCAD \uC5ED\uD560")} required>
          {(p) => (
            <Select
              {...p}
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            >
              <option value="">
                {t("\uC5ED\uD560\uC744 \uC120\uD0DD\uD558\uC138\uC694")}
              </option>
              {s.directory.roles
                .filter((r) => r.platformId === platform)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {rolePaths(s, actorId).some((p) => p.role.id === r.id)
                      ? t(" \u00B7 \uBCF4\uC720 \uC911")
                      : ""}
                  </option>
                ))}
            </Select>
          )}
        </Field>
        {role && (
          <div className="access-option">
            <span>
              <strong>{role.name}</strong>
              <small>{role.description}</small>
              <small>
                {t("\uC815\uCC45:")}{" "}
                {role.policyIds
                  .map((id) => name(s.directory.policies, id))
                  .join(", ") || t("\uC5C6\uC74C")}
              </small>
            </span>
          </div>
        )}
        {(held || pending) && (
          <p role="alert">
            {held
              ? t(
                  "\uC774\uBBF8 \uC9C1\uC811 \uB610\uB294 \uC870\uC9C1\uC744 \uD1B5\uD574 \uBCF4\uC720\uD55C \uC5ED\uD560\uC785\uB2C8\uB2E4.",
                )
              : t(
                  "\uB3D9\uC77C \uC5ED\uD560\uC758 \uC2E0\uCCAD\uC774 \uC9C4\uD589 \uC911\uC785\uB2C8\uB2E4.",
                )}
          </p>
        )}
        <Field
          label={t("\uC0AC\uC6A9 \uC885\uB8CC\uC77C")}
          hint={t(
            "\uBE44\uC6CC \uB450\uBA74 \uBB34\uAE30\uD55C\uC73C\uB85C \uC2E0\uCCAD\uD569\uB2C8\uB2E4.",
          )}
        >
          {(p) => (
            <Input
              {...p}
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          )}
        </Field>
        <Field
          label={t("\uC2E0\uCCAD \uC0AC\uC720")}
          required
          hint={t(
            "\uC5C5\uBB34 \uBAA9\uC801\uACFC \uD544\uC694\uD55C \uC811\uADFC \uBC94\uC704\uB97C \uC801\uC5B4 \uC8FC\uC138\uC694.",
          )}
        >
          {(p) => (
            <Textarea
              {...p}
              placeholder={t(
                "\uC608: \uBCF4\uC548 \uC810\uAC80 \uC5C5\uBB34\uB97C \uC704\uD574 \uAC80\uD1A0 \uB0B4\uC5ED \uC870\uD68C\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.",
              )}
              value={reason}
              maxLength={2000}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </Field>
      </section>
      <section className="ui-panel access-card">
        <p className="access-kicker">02 APPROVAL ROUTE</p>
        <p>{t("권한 신청 → 결재 → 승인 후 권한 반영")}</p>
        <p className="access-note">
          {t(
            "신청하면 결재 문서가 생성됩니다. 최종 승인 후 담당 조직이 권한을 반영합니다.",
          )}
        </p>
        <Ref href="/approvals">{t("결재 내역 확인")}</Ref>
        <h2>{t("결재선")}</h2>
        <ol className="wf-line">
          {workflow.templates
            .find((t) => t.type === "access")
            ?.line.map((l, i) => (
              <li key={i}>
                <span className="wf-step">{i + 1}</span>
                <div>
                  <strong>{t(l.label)}</strong>
                  <p>
                    {l.kind === "requester-leader"
                      ? name(
                          workflow.users,
                          workflow.leaders.find((v) => v.userId === actorId)
                            ?.leaderId ?? "",
                        )
                      : name(workflow.organizations, l.id)}
                  </p>
                </div>
              </li>
            ))}
        </ol>
        {!workflow.templates.some((v) => v.type === "access") && (
          <p role="alert">
            {t("권한 신청 결재 템플릿이 등록되지 않았습니다.")}
          </p>
        )}
        {!s.directory.members.some(
          (m) =>
            m.userId === actorId &&
            m.platformId === platform &&
            m.status === "active",
        ) && (
          <p role="alert">{t("선택한 플랫폼의 활성 멤버십이 필요합니다.")}</p>
        )}
        <p className="access-note">
          {t(
            "\uC2E0\uCCAD\uC740 \uC811\uC218 \uC0C1\uD0DC\uB85C \uB4F1\uB85D\uB429\uB2C8\uB2E4. \uC2B9\uC778 \uC804\uC5D0\uB294 \uC5ED\uD560\uC774 \uBD80\uC5EC\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
          )}
        </p>
      </section>
      <div className="access-foot">
        <Link
          href="/my-access"
          className="ui-button ui-button--ghost ui-button--md"
        >
          {t("\uCDE8\uC18C")}
        </Link>
        <Button disabled={!valid} onClick={() => setReview(true)}>
          {t("\uC2E0\uCCAD \uB0B4\uC6A9 \uAC80\uD1A0")}
        </Button>
      </div>
      {review && (
        <Dialog
          title={t("\uAD8C\uD55C \uC2E0\uCCAD \uAC80\uD1A0")}
          description={t(
            "\uC2E0\uCCAD \uB300\uC0C1\uACFC \uC0AC\uC6A9 \uAE30\uAC04\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.",
          )}
          trigger={null}
          open
          onOpenChange={setReview}
          busy={mutation.busy}
          size="wide"
        >
          <Details
            items={[
              {
                label: t("\uC2E0\uCCAD\uC790"),
                value: name(s.directory.users, actorId),
              },
              {
                label: t("\uD50C\uB7AB\uD3FC"),
                value: name(s.directory.platforms, platform),
              },
              { label: t("\uC2E0\uCCAD \uC5ED\uD560"), value: role?.name },
              {
                label: t("\uC0AC\uC6A9 \uC885\uB8CC\uC77C"),
                value: date(expires),
              },
              { label: t("\uC0AC\uC720"), value: reason },
            ]}
          />
          <Notice>
            {t(
              "\uC2E0\uCCAD \uC811\uC218\uB9CC\uC73C\uB85C \uC811\uADFC \uAD8C\uD55C\uC774 \uBCC0\uACBD\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
            )}
          </Notice>
          {mutation.error && <p role="alert">{mutation.error}</p>}
          <div className="access-foot">
            <Button variant="secondary" onClick={() => setReview(false)}>
              {t("\uC774\uC804")}
            </Button>
            <Button
              disabled={!valid}
              loading={mutation.busy}
              onClick={async () => {
                if (
                  await mutation.run({
                    kind: "access-request",
                    requestId,
                    platformId: platform,
                    roleId,
                    reason: reason.trim(),
                    expiresAt: expires,
                  })
                ) {
                  router.push("/my-access?tab=requests&submitted=1");
                }
              }}
            >
              {t("\uC2E0\uCCAD \uC81C\uCD9C")}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
export function MyAccess({
  d,
  actorId,
  workflow,
}: {
  d: Directory;
  actorId: string;
  workflow: WorkflowState;
}) {
  const { t } = useI18n();
  const s = useAccess(d, workflow),
    params = useSearchParams();
  return (
    <div className="ui-layout-stack">
      <PageHeading
        title={t("\uB0B4 \uC811\uADFC \uAD8C\uD55C")}
        description={t(
          "\uC0AC\uC6A9 \uAC00\uB2A5\uD55C \uD50C\uB7AB\uD3FC\uACFC \uBCF4\uC720 \uAD8C\uD55C, \uC9C4\uD589 \uC911\uC778 \uC2E0\uCCAD\uC744 \uD655\uC778\uD569\uB2C8\uB2E4.",
        )}
        actions={
          <Ref href="/access-requests/new">
            {t("\uAD8C\uD55C \uC2E0\uCCAD \u2192")}
          </Ref>
        }
      />
      <section className="ui-panel access-card">
        <div className="access-person">
          <div className="access-avatar">
            {name(s.directory.users, actorId).slice(0, 1)}
          </div>
          <div>
            <strong>{name(s.directory.users, actorId)}</strong>
            <p className="access-note">
              {s.directory.users.find((u) => u.id === actorId)?.email}
            </p>
          </div>
        </div>
      </section>
      {params.get("submitted") === "1" && (
        <Notice>
          {t(
            "\uAD8C\uD55C \uC2E0\uCCAD\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC2E0\uCCAD \uB0B4\uC5ED\uC5D0\uC11C \uC9C4\uD589 \uC0C1\uD0DC\uB97C \uD655\uC778\uD558\uC138\uC694.",
          )}
        </Notice>
      )}
      <DetailTabs
        items={[
          {
            value: "access",
            label: t("\uBCF4\uC720 \uAD8C\uD55C"),
            content: (
              <div className="ui-layout-stack">
                <UserPolicyAccess id={actorId} />
                <AccessSummary d={d} userId={actorId} workflow={workflow} own />
              </div>
            ),
          },
          {
            value: "requests",
            label: `${t("신청 내역")} (${workflow.documents.filter((r) => r.access && r.requesterId === actorId).length})`,
            content: <AccessRequests s={workflow} />,
          },
        ]}
      />
    </div>
  );
}
