import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { Status } from "./types";
export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge tone={status === "active" ? "success" : "neutral"}>
      {status === "active" ? "활성" : "비활성"}
    </Badge>
  );
}
export function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(value))
    : "기록 없음";
}
export function DemoNotice() {
  return (
    <p className="identity-demo">
      <Badge>예제 데이터</Badge>조회 화면 미리보기입니다. 실제 사내 계정과
      연결되지 않았습니다.
    </p>
  );
}
export function Summary({
  items,
}: {
  items: { label: string; value: number }[];
}) {
  return (
    <div className="identity-summary">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
export function Details({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="identity-details">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
