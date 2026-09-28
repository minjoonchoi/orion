import { ContractDetail } from "@/features/definition-contract/catalog";
import { redirect } from "next/navigation";
import { deployment } from "@/lib/api/server";
import { legacyPages } from "@/features/definitions/legacy-links";
import { Suspense } from "react";
import { DefinitionsScreen } from "@/features/definitions/screen";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (deployment().mode === "demo" && legacyPages[id])
    redirect("/pages/" + legacyPages[id]);
  return (
    <Suspense>
      <ContractDetail kind="page" id={id}>
        <DefinitionsScreen kind="pages" id={id} />
      </ContractDetail>
    </Suspense>
  );
}
