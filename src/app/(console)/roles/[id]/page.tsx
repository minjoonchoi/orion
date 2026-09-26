import { loadWorkflow } from "@/features/approval-workflow/server";
import { ManagedGrantScreen } from "@/features/approval-workflow/screens";
import { Suspense } from "react";
import { loadDirectory } from "@/features/platforms/repository";
import { ScopedRoleScreen } from "@/features/platforms/screens";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; memberId: string }>;
}) {
  const { id } = await params;
  const workflow = await loadWorkflow();
  const managed = workflow.keys.find(
    (k) => k.roleId === id && k.status === "active",
  );
  if (managed)
    return (
      <Suspense>
        <ManagedGrantScreen s={workflow} k={managed} kind="roles" />
      </Suspense>
    );
  const d = await loadDirectory();
  if (!d.roles.some((r) => r.id === id)) notFound();
  return (
    <Suspense>
      <ScopedRoleScreen d={d} id={id} />
    </Suspense>
  );
}
