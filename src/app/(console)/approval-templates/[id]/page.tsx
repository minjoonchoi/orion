import { Suspense } from "react";
import { notFound } from "next/navigation";
import { loadWorkflow } from "@/features/approval-workflow/server";
import { TemplateScreen } from "@/features/approval-workflow/screens";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await loadWorkflow();
  const item = s.templates.find((v) => v.id === id);
  if (!item) {
    notFound();
  }
  return (
    <Suspense>
      <TemplateScreen s={s} t={item} />
    </Suspense>
  );
}
