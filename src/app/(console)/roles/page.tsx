import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { RolesList } from "@/features/access/screens";
import { accessRepository } from "@/features/access/repository";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("역할") };
}
export default async function Page() {
  return <RolesList rows={await accessRepository.listRoles()} />;
}
