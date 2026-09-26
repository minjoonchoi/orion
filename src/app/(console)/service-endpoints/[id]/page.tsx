import { redirect } from "next/navigation";
import { deployment } from "@/lib/api/server";
import { legacyEndpoints } from "@/features/definitions/legacy-links";
import { Suspense } from "react";
import { DefinitionsScreen } from "@/features/definitions/screen";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (deployment().mode === "demo" && legacyEndpoints[id])
    redirect("/service-endpoints/" + legacyEndpoints[id]);
  return (
    <Suspense>
      <DefinitionsScreen kind="service-endpoints" id={id} />
    </Suspense>
  );
}
