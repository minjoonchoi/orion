import { getT } from "@/i18n/server";
import type { Metadata } from "next";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("접근 권한") };
}
export default async function Page() {
  const t = await getT();
  const item = {
    label: t("접근 권한"),
    description: t("부여된 접근 권한을 관리합니다."),
  };
  return (
    <>
      <PageHeading title={item.label} description={item.description} />
      <EmptyState />
    </>
  );
}
