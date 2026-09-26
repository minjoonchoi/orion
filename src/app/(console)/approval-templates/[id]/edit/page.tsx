import { notFound, redirect } from "next/navigation";
import { loadWorkflow } from "@/features/approval-workflow/server";
import { TemplateEditorScreen } from "@/features/approval-workflow/screens";
import { deployment } from "@/lib/api/server";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const s = await loadWorkflow();
  if (!s.templateAdminIds.includes(s.actorId)) redirect("/forbidden");
  const { id } = await params;
  const t = s.templates.find((t) => t.id === id);
  if (!t) notFound();
  return (
    <TemplateEditorScreen s={s} t={t} demo={deployment().mode === "demo"} />
  );
}
