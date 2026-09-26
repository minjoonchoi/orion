import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { UsersList } from "@/features/identity/screens";
import { identityRepository } from "@/features/identity/repository";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("사용자") };
}
export default async function Page() {
  return (
    <UsersList
      rows={await identityRepository.listUsers()}
      organizations={await identityRepository.listOrganizations()}
    />
  );
}
