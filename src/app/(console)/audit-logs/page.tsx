import type { Metadata } from "next";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
export const metadata: Metadata = { title: "감사 로그" };
export default function Page() {
  const item = {
    label: "감사 로그",
    description: "권한 변경과 접근 이력을 확인합니다.",
  };
  return (
    <>
      <PageHeading title={item.label} description={item.description} />
      <EmptyState />
    </>
  );
}
