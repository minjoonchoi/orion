import type { Metadata } from "next";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { navigation } from "@/config/navigation";
export const metadata: Metadata = { title: "정책" };
export default function Page() {
  const item = navigation.find((item) => item.href === "/policies")!;
  return (
    <>
      <PageHeading title={item.label} description={item.description} />
      <EmptyState />
    </>
  );
}
