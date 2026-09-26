"use client";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { requestKey } from "./issuance";
export function IssueKeyDialog({
  account,
  services,
}: {
  account: { id: string; name: string; status: string };
  services: { id: string; name: string }[];
}) {
  const { t, mode } = useI18n();
  const [open, setOpen] = useState(false),
    [stage, setStage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [service, setService] = useState(""),
    [name, setName] = useState(""),
    [reason, setReason] = useState(""),
    [expiry, setExpiry] = useState(""),
    [requestId, setRequestId] = useState(""),
    [receipt, setReceipt] = useState("");
  const errors: Record<string, string> = {
    INVALID_INPUT: "입력값과 만료일을 확인하세요.",
    NOT_ELIGIBLE: "발급 가능한 서비스 또는 어카운트가 아닙니다.",
    FORBIDDEN: "접근 권한이 없습니다",
    UNAUTHENTICATED: "로그인이 필요합니다",
    CONFLICT: "요청 내용이 변경되었습니다. 창을 다시 열어 주세요.",
    REQUEST_FAILED: "발급 요청에 실패했습니다. 다시 시도해 주세요.",
  };
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const result = await requestKey({
        accountId: account.id,
        serviceId: service,
        name,
        reason,
        expiresAt: new Date(expiry).toISOString(),
        requestId,
      });
      if (result.error) setError(result.error);
      else if (result.data) setReceipt(result.data.id);
    } catch {
      setError("REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={t("API 키 발급 요청")}
      description={t(
        "서비스 어카운트와 관리 서비스를 확인한 후 발급을 요청합니다.",
      )}
      open={open}
      busy={busy}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setStage(1);
          setService(services[0]?.id ?? "");
          setName("");
          setReason("");
          setExpiry("");
          setError("");
          setReceipt("");
          setRequestId(crypto.randomUUID());
        }
      }}
      trigger={
        <Button disabled={account.status !== "active" || !services.length}>
          {t("API 키 발급 요청")}
        </Button>
      }
    >
      {receipt ? (
        <div role="status">
          <h3>{t("발급 요청이 접수되었습니다.")}</h3>
          <p>{t("승인 및 발급이 완료되면 API 키 목록에 표시됩니다.")}</p>
          <p>{receipt}</p>
          {mode === "demo" && (
            <p>
              {t(
                "예제 모드에서는 요청만 접수하며 실제 키를 생성하지 않습니다.",
              )}
            </p>
          )}
        </div>
      ) : (
        <form
          className="ui-stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (stage === 1) {
              if (Date.parse(expiry) <= Date.now()) {
                setError("INVALID_INPUT");
                return;
              }
              setError("");
              setStage(2);
            } else void submit();
          }}
        >
          <p>{t(stage === 1 ? "1. 발급 대상 선택" : "2. 요청 내용 검토")}</p>
          {stage === 1 ? (
            <>
              <p>
                {t("서비스 어카운트")}: <strong>{account.name}</strong>
              </p>
              <label>
                {t("관리 서비스")}
                <select
                  className="ui-input"
                  aria-label={t("관리 서비스")}
                  required
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("키 이름")}
                <input
                  className="ui-input"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                {t("만료일")}
                <input
                  className="ui-input"
                  type="datetime-local"
                  required
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                />
              </label>
              <label>
                {t("요청 사유")}
                <textarea
                  className="ui-input"
                  required
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            </>
          ) : (
            <dl className="identity-details">
              <div>
                <dt>{t("서비스 어카운트")}</dt>
                <dd>{account.name}</dd>
              </div>
              <div>
                <dt>{t("관리 서비스")}</dt>
                <dd>{services.find((s) => s.id === service)?.name}</dd>
              </div>
              <div>
                <dt>{t("키 이름")}</dt>
                <dd>{name}</dd>
              </div>
              <div>
                <dt>{t("만료일")}</dt>
                <dd>{expiry.replace("T", " ")}</dd>
              </div>
              <div>
                <dt>{t("요청 사유")}</dt>
                <dd>{reason}</dd>
              </div>
            </dl>
          )}
          {error && (
            <p role="alert">{t(errors[error] ?? errors.REQUEST_FAILED)}</p>
          )}
          <div>
            {stage === 2 && (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setStage(1)}
              >
                {t("이전")}
              </Button>
            )}
            <Button type="submit" disabled={busy}>
              {t(stage === 1 ? "요청 내용 검토" : "발급 요청 제출")}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
