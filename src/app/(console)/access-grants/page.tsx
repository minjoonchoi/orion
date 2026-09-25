import type { Metadata } from "next";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
export const metadata: Metadata = { title: "접근 권한" };
export default function Page() {
  const item = {
    label: "접근 권한",
    description: "부여된 접근 권한을 관리합니다.",
  };
  return (
    <>
      <PageHeading title={item.label} description={item.description} />
      <EmptyState />
    </>
  );
}
