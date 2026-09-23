import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { PoliciesList } from "@/features/access/screens";
import { accessRepository } from "@/features/access/repository";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("정책") };
}
export default async function Page() {
  return <PoliciesList rows={await accessRepository.listPolicies()} />;
}
