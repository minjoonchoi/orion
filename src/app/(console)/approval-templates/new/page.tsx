import { redirect } from "next/navigation";
import { loadWorkflow } from "@/features/approval-workflow/server";
import { TemplateEditorScreen } from "@/features/approval-workflow/screens";
import { deployment } from "@/lib/api/server";
export default async function Page() {
  const s = await loadWorkflow();
  if (!s.templateAdminIds.includes(s.actorId)) redirect("/forbidden");
  return <TemplateEditorScreen s={s} demo={deployment().mode === "demo"} />;
}
