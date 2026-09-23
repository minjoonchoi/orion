import type { Metadata } from "next";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { navigation } from "@/config/navigation";
export const metadata: Metadata = { title: "서비스 엔드포인트" };
export default function Page() {
  const item = navigation.find((item) => item.href === "/service-endpoints")!;
  return (
    <>
      <PageHeading title={item.label} description={item.description} />
      <EmptyState />
    </>
  );
}
