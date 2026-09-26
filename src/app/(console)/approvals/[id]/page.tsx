import { Suspense } from "react";
import { redirect } from "next/navigation";
import { loadWorkflow } from "@/features/approval-workflow/server";
import { DocumentScreen } from "@/features/approval-workflow/screens";
import { deployment } from "@/lib/api/server";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await loadWorkflow();
  const item = s.documents.find((v) => v.id === id);
  if (!item) {
    redirect("/forbidden");
  }
  return (
    <Suspense>
      <DocumentScreen s={s} d={item} demo={deployment().mode === "demo"} />
    </Suspense>
  );
}
