"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SyncDialog } from "../sync-workflow/dialog";
import type { Selection } from "../sync-workflow/model";
import { loadSync, syncHistory } from "./actions";
import { diff, type Snapshot, type Run } from "./model";
import { DateValue, useI18n } from "@/i18n/provider";
import { ResourceHistoryDialog } from "./history";
import { resourceKinds, type ResourceKind } from "../authorization/model";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ResourceImpact } from "../authorization/resource-impact";
export function ResourceDeploymentStatus({
  kind,
  id,
}: {
  kind: string;
  id: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [syncSelection, setSyncSelection] = useState<Selection | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [impactOpen, setImpactOpen] = useState(false);
  const [impactBusy, setImpactBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadSync(), syncHistory(kind, id)])
      .then(([s, h]) => {
        if (cancelled) return;
        if (s.data) setSnapshot(s.data);
        else setError(true);
        if (h.data) setRuns(h.data);
        else setError(true);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [kind, id, version]);
  const changed =
    snapshot &&
    diff(snapshot).rows.some(
      (r) =>
        r.after.kind === kind &&
        r.after.id === id &&
        r.operation !== "unchanged",
    );
  const applied = runs.find(
    (r) => r.status === "succeeded" && r.phase !== "baseline",
  );
  return (
    <section className="access-entry">
      <p>
        {t(
          "리소스 정의는 Git에서 관리합니다. 수정·삭제는 YAML 변경 후 동기화하세요.",
        )}
      </p>
      {snapshot && (
        <p>
          {t(applied ? "이 리소스의 최근 적용" : "환경 기준 revision")}:{" "}
          {applied && <code>{applied.commit} · </code>}revision{" "}
          {applied?.dbRevision ?? snapshot.dbRevision}
          {applied?.completedAt && (
            <>
              {" "}
              · {t("적용 완료 시간")}:{" "}
              <DateValue value={applied.completedAt} time />
            </>
          )}
        </p>
      )}
      {error && (
        <p role="alert">{t("요청하지 못했습니다. 다시 시도해 주세요.")}</p>
      )}
      <Link
        href={
          changed
            ? `/resources?tab=changes&type=${kind}&resource=${id}`
            : `/resources?type=${kind}`
        }
      >
        {t(changed ? "변경 예정 · diff 확인" : "리소스 관리")}
      </Link>
      <Button
        size="sm"
        disabled={!snapshot}
        onClick={() =>
          setSyncSelection({
            mode: "resources",
            resources: [{ kind: kind as ResourceKind, id }],
            policyIds: [],
          })
        }
      >
        Sync
      </Button>
      {syncSelection && (
        <SyncDialog
          selection={syncSelection}
          onClose={() => setSyncSelection(null)}
          onApplied={() => {
            setVersion((v) => v + 1);
            router.refresh();
          }}
        />
      )}
      <Button
        size="sm"
        variant="secondary"
        disabled={!snapshot || impactBusy}
        loading={impactBusy}
        onClick={async () => {
          setImpactBusy(true);
          setError(false);
          try {
            const result = await loadSync();
            if (result.data) {
              setSnapshot(result.data);
              setImpactOpen(true);
            } else setError(true);
          } catch {
            setError(true);
          } finally {
            setImpactBusy(false);
          }
        }}
      >
        {t("영향도 보기")}
      </Button>
      <Dialog
        title={t("리소스 영향도 검토")}
        description={t("조회 대상으로 선택한 리소스의 연결 관계만 표시합니다.")}
        trigger={<button hidden aria-label={t("리소스 영향도 검토")} />}
        open={impactOpen}
        onOpenChange={setImpactOpen}
      >
        {snapshot && resourceKinds.includes(kind as ResourceKind) && (
          <div className="resource-impact-review">
            <p className="muted">
              {snapshot.environment} / {snapshot.region} · {t("조회 기준")}{" "}
              revision {snapshot.dbRevision}
            </p>
            <ResourceImpact
              graph={snapshot.graph}
              resources={[{ kind: kind as ResourceKind, id }]}
            />
          </div>
        )}
      </Dialog>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setHistoryOpen(true)}
      >
        {t("동기화 이력")}
      </Button>
      {historyOpen && resourceKinds.includes(kind as ResourceKind) && (
        <ResourceHistoryDialog
          kind={kind as ResourceKind}
          id={id}
          name={
            snapshot?.graph.resources.find(
              (r) => r.kind === kind && r.id === id,
            )?.name ?? id
          }
          onClose={() => setHistoryOpen(false)}
          onUpdated={() => setVersion((v) => v + 1)}
        />
      )}
    </section>
  );
}
