import { getT } from "@/i18n/server";
import type { Metadata } from "next";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("감사 로그") };
}
export default async function Page() {
  const t = await getT();
  const item = {
    label: t("감사 로그"),
    description: t("권한 변경과 접근 이력을 확인합니다."),
  };
  return (
    <>
      <PageHeading title={item.label} description={item.description} />
      <EmptyState />
    </>
  );
}
