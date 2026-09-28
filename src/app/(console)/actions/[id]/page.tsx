import { ContractDetail } from "@/features/definition-contract/catalog";
import { Suspense } from "react";
import { DefinitionsScreen } from "@/features/definitions/screen";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <ContractDetail kind="action" id={id}>
        <DefinitionsScreen kind="actions" id={id} />
      </ContractDetail>
    </Suspense>
  );
}
