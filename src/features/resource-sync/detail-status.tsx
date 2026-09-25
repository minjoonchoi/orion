"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { loadSync, syncHistory } from "./actions";
import { diff, type Snapshot, type Run } from "./model";
import { DateValue, useI18n } from "@/i18n/provider";
export function ResourceDeploymentStatus({
  kind,
  id,
}: {
  kind: string;
  id: string;
}) {
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadSync(), syncHistory()])
      .then(([s, h]) => {
        if (cancelled) return;
        if (s.data) setSnapshot(s.data);
        else setError(true);
        if (h.data) setRuns(h.data);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);
  const changed =
    snapshot &&
    diff(snapshot).rows.some(
      (r) =>
        r.after.kind === kind &&
        r.after.id === id &&
        r.operation !== "unchanged",
    );
  const applied = runs.find(
    (r) => r.status === "succeeded" && r.commit === snapshot?.appliedCommit,
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
          Synced: <code>{snapshot.appliedCommit}</code> · revision{" "}
          {snapshot.dbRevision}
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
    </section>
  );
}
