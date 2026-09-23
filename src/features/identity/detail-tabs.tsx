"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Tabs } from "@/components/ui/tabs";
export function DetailTabs({
  items,
}: {
  items: { value: string; label: string; content: ReactNode }[];
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const requested = params.get("tab");
  const value = items.some((i) => i.value === requested) ? requested! : "info";
  return (
    <Tabs
      label="상세 정보"
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
