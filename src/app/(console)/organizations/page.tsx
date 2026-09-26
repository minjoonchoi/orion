import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { OrganizationsList } from "@/features/identity/screens";
import { identityRepository } from "@/features/identity/repository";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("조직") };
}
export default async function Page() {
  return (
    <OrganizationsList rows={await identityRepository.listOrganizations()} />
  );
}
