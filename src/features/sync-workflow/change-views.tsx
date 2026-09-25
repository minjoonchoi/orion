"use client";
import { useState, type ReactNode } from "react";
import { Tabs } from "@/components/ui/tabs";
import { useI18n } from "@/i18n/provider";
import { yamlDiff } from "./yaml-diff";
import "./change-views.css";
export function ChangeViews({
  yaml,
  impact,
}: {
  yaml: ReactNode;
  impact: ReactNode;
}) {
  const [view, setView] = useState("yaml");
  return (
    <Tabs
      label="변경 검토 보기"
      value={view}
      onValueChange={setView}
      items={[
        { value: "yaml", label: "YAML diff", content: yaml },
        { value: "impact", label: "영향도", content: impact },
      ]}
    />
  );
}
export function YamlDiff({
  before,
  after,
}: {
  before: object | null;
  after: object | null;
}) {
  const { t } = useI18n();
  const lines = yamlDiff(before, after);
  return (
    <div className="yaml-review">
      <p className="muted">
        {t(
          "적용된 정의와 동기화할 정의를 YAML로 비교합니다. 원본 파일의 주석과 서식은 제외됩니다.",
        )}
      </p>
      <div className="yaml-legend">
        <span>− Synced</span>
        <span>+ Out of sync</span>
        <span>
          +{lines.filter((l) => l.type === "add").length} / −
          {lines.filter((l) => l.type === "remove").length}
        </span>
      </div>
      <div
        className="yaml-code"
        role="region"
        aria-label="YAML diff"
        tabIndex={0}
      >
        <pre>
          {lines.map((line, index) => (
            <div className={`yaml-line ${line.type}`} key={index}>
              <span className="yaml-number" aria-hidden="true">
                {line.old ?? ""}
              </span>
              <span className="yaml-number" aria-hidden="true">
                {line.next ?? ""}
              </span>
              <code>
                {line.type === "add" ? "+" : line.type === "remove" ? "−" : " "}{" "}
                {line.text}
              </code>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
