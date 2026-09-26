"use client";
import { useI18n } from "@/i18n/provider";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Tabs } from "@/components/ui/tabs";
export function DetailTabs({
  items,
  actions = {},
  aliases = {},
}: {
  items: { value: string; label: string; content: ReactNode }[];
  actions?: Record<string, ReactNode>;
  aliases?: Record<string, string>;
}) {
  const { t } = useI18n();
  const params = useSearchParams();
  const pathname = usePathname();
  const summary = items.find((item) => item.value === "info");
  const relations = items.filter((item) => item.value !== "info");
  const rawTab = params.get("tab") ?? "";
  const requested = aliases[rawTab] ?? rawTab;
  const value = relations.some((i) => i.value === requested)
    ? requested!
    : (relations[0]?.value ?? "");
  return (
    <div className="ui-stack detail-layout">
      {summary && <div data-detail-summary>{summary.content}</div>}
      {relations.length > 0 && (
        <Tabs
          label={t("상세 정보")}
          items={relations.map((item) => ({
            ...item,
            content: (
              <>
                {actions[item.value] && (
                  <div className="detail-tab-actions">
                    {actions[item.value]}
                  </div>
                )}
                {item.content}
              </>
            ),
          }))}
          value={value}
          onValueChange={(next) => {
            const query = new URLSearchParams(params.toString());
            query.set("tab", next);
            window.history.pushState(null, "", `${pathname}?${query}`);
          }}
        />
      )}
    </div>
  );
}
