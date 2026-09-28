import { Suspense } from "react";
import { ContractDetail } from "@/features/definition-contract/catalog";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <ContractDetail kind="masking" id={id} />
    </Suspense>
  );
}
