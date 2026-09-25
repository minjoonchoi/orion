import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { WorkspacesList } from "@/features/resources/screens";
import { resourceRepository } from "@/features/resources/repository";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("워크스페이스") };
}
export default async function Page() {
  return <WorkspacesList rows={await resourceRepository.listWorkspaces()} />;
}
