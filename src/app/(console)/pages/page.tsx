import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { PagesList } from "@/features/resources/screens";
import { resourceRepository } from "@/features/resources/repository";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("페이지") };
}
export default async function Page() {
  return (
    <PagesList
      rows={await resourceRepository.listPages()}
      workspaces={await resourceRepository.listWorkspaces()}
    />
  );
}
