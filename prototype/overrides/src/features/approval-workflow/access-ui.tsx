"use client";
import { useState } from "react";
import Link from "next/link";
import { useI18n, DateValue } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Details } from "../identity/shared";
import { BrowseTable } from "../identity/browse-table";
import { canExecute, type State, type Document } from "./model";
import { useMutation, Status } from "./screens";
function useText() {
  const { locale } = useI18n();
  return (ko: string, en: string) => (locale === "en" ? en : ko);
}
export function AccessRequestInfo({ d }: { d: Document }) {
  const text = useText(),
    a = d.access;
  if (!a) return null;
  return (
    <Details
      items={[
        { label: text("플랫폼", "Platform"), value: a.platformName },
        { label: text("신청 역할", "Requested role"), value: a.roleName },
        {
          label: text("승인 대상 정책", "Policies submitted for approval"),
          value: a.policyIds.join(", ") || text("없음", "None"),
        },
        {
          label: text("사용 종료일 (한국 시간)", "Expiry date (Korea time)"),
          value: a.expiresAt || text("무기한", "No expiry"),
        },
        { label: text("신청 사유", "Reason"), value: a.reason },
      ]}
    />
  );
}
export function AccessExecution({ s, d }: { s: State; d: Document }) {
  const text = useText(),
    m = useMutation(s),
    [review, setReview] = useState(false);
  const cancelled = d.status === "cancelled" || d.status === "rejected";
  return (
    <section className="ui-panel ui-layout-stack">
      <h2>{text("권한 반영", "Apply permissions")}</h2>
      <AccessRequestInfo d={d} />
      <p>
        {text("반영 담당 조직", "Provisioning team")}:{" "}
        {s.organizations.find((o) => o.id === d.serviceTeamId)?.name ??
          d.serviceTeamId}
      </p>
      {d.execution === "completed" ? (
        <p>
          <Status value="completed" /> · <DateValue value={d.executedAt} time />{" "}
          · {s.users.find((u) => u.id === d.executorId)?.name}
        </p>
      ) : (
        <p>
          {cancelled
            ? text(
                "종료된 신청입니다. 권한이 부여되지 않습니다.",
                "This request is closed. No permission will be granted.",
              )
            : text(
                "최종 승인 후 담당 조직이 권한을 반영합니다. 멤버십, 역할의 정책 구성과 사용 기간을 다시 확인합니다.",
                "After final approval, the responsible team applies the grant. Membership, role policies and expiry are checked again.",
              )}
        </p>
      )}
      {canExecute(s, d) && (
        <Button loading={m.busy} onClick={() => setReview(true)}>
          {text("권한 반영 검토", "Review permission grant")}
        </Button>
      )}
      <Link className="identity-link" href="/my-access?tab=requests">
        {text("내 신청 내역", "My requests")}
      </Link>
      {m.error && <p role="alert">{m.error}</p>}
      <Dialog
        trigger={null}
        open={review}
        onOpenChange={setReview}
        title={text("권한 반영 검토", "Review permission grant")}
        description={text(
          "승인된 역할과 사용 기간을 확인하세요.",
          "Check the approved role and expiry.",
        )}
        busy={m.busy}
      >
        <AccessRequestInfo d={d} />
        <Button
          loading={m.busy}
          onClick={async () => {
            if (await m.run({ kind: "execute", id: d.id, secretText: "" }))
              setReview(false);
          }}
        >
          {text("권한 반영", "Apply permissions")}
        </Button>
        {m.error && <p role="alert">{m.error}</p>}
      </Dialog>
    </section>
  );
}
export function AccessRequests({ s }: { s: State }) {
  const text = useText(),
    m = useMutation(s),
    [cancel, setCancel] = useState<Document | null>(null);
  const rows = s.documents.filter(
    (d) => d.access && d.requesterId === s.actorId,
  );
  return (
    <div className="ui-layout-stack">
      <BrowseTable
        title={text("내 권한 신청", "My access requests")}
        rows={rows}
        searchText={(d) => d.id + d.access!.roleName + d.access!.reason}
        sortValue={(d) => d.createdAt}
        emptyTitle={text(
          "아직 신청한 권한이 없습니다",
          "No access requests yet",
        )}
        columns={[
          {
            key: "id",
            header: text("신청 / 결재 문서", "Request / Approval"),
            render: (d) => (
              <Link className="identity-link" href={`/approvals/${d.id}`}>
                {d.access!.roleName}
              </Link>
            ),
          },
          {
            key: "platform",
            header: text("플랫폼", "Platform"),
            render: (d) => d.access!.platformName,
          },
          {
            key: "status",
            header: text("결재 상태", "Approval status"),
            render: (d) => <Status value={d.status} />,
          },
          {
            key: "execution",
            header: text("권한 반영", "Provisioning"),
            render: (d) =>
              d.status === "rejected" || d.status === "cancelled" ? (
                "—"
              ) : (
                <Status value={d.execution} />
              ),
          },
          {
            key: "expiry",
            header: text("사용 종료일", "Expiry"),
            render: (d) => d.access!.expiresAt || text("무기한", "No expiry"),
          },
          {
            key: "cancel",
            header: text("작업", "Actions"),
            render: (d) =>
              d.status === "pending" ||
              (d.status === "approved" && d.execution === "ready") ? (
                <Button variant="ghost" onClick={() => setCancel(d)}>
                  {text("신청 취소", "Cancel request")}
                </Button>
              ) : (
                "—"
              ),
          },
        ]}
      />
      {m.error && <p role="alert">{m.error}</p>}
      <Dialog
        trigger={null}
        open={!!cancel}
        onOpenChange={(v) => {
          if (!v) setCancel(null);
        }}
        title={text("권한 신청 취소", "Cancel access request")}
        description={text(
          "아직 권한이 반영되지 않은 신청을 취소합니다. 보유한 권한은 바뀌지 않습니다.",
          "Cancel this unprovisioned request. Existing access is unchanged.",
        )}
        busy={m.busy}
      >
        {cancel && <AccessRequestInfo d={cancel} />}
        <Button
          variant="danger"
          loading={m.busy}
          onClick={async () => {
            if (cancel && (await m.run({ kind: "cancel", id: cancel.id })))
              setCancel(null);
          }}
        >
          {text("취소 확정", "Confirm cancellation")}
        </Button>
        {m.error && <p role="alert">{m.error}</p>}
      </Dialog>
    </div>
  );
}
