"use client";
import { useI18n } from "@/i18n/provider";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Tabs } from "@/components/ui/tabs";
export function DetailTabs({
  items,
}: {
  items: { value: string; label: string; content: ReactNode }[];
}) {
  const { t } = useI18n();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const requested = params.get("tab");
  const value = items.some((i) => i.value === requested) ? requested! : "info";
  return (
    <Tabs
      label={t("상세 정보")}
      items={items}
      value={value}
      onValueChange={(next) => {
        const query = new URLSearchParams(params.toString());
        query.set("tab", next);
        router.push(`${pathname}?${query}`, { scroll: false });
      }}
    />
  );
}
