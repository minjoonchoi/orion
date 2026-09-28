import { ContractDetail } from "@/features/definition-contract/catalog";
import { files } from "@/features/definition-contract/fixtures";
import { parseFiles } from "@/features/definition-contract/model";
import { deployment } from "@/lib/api/server";
import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { getRelatedGroups } from "@/features/relationships/repository";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { OrganizationScreen } from "@/features/identity/screens";
import { identityRepository } from "@/features/identity/repository";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("조직 상세") };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getT();
  const { id } = await params;
  const data = await identityRepository.getOrganization(id);
  if (
    !data &&
    deployment().mode === "demo" &&
    parseFiles(files).some((d) => d.kind === "organization" && d.id === id)
  )
    return (
      <Suspense>
        <ContractDetail kind="organization" id={id} />
      </Suspense>
    );
  if (!data) notFound();
  const groups = await getRelatedGroups("organizations", id);
  return (
    <Suspense fallback={<p role="status">{t("불러오는 중…")}</p>}>
      <OrganizationScreen data={data} groups={groups} />
    </Suspense>
  );
}
