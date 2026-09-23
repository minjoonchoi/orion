import type { Metadata } from "next";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { navigation } from "@/config/navigation";
export const metadata: Metadata = { title: "페이지" };
export default function Page() {
  const item = navigation.find((item) => item.href === "/pages")!;
  return (
    <>
      <PageHeading title={item.label} description={item.description} />
      <EmptyState />
    </>
  );
}
