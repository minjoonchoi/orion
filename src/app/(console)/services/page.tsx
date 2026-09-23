import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { ServicesList } from "@/features/resources/screens";
import { resourceRepository } from "@/features/resources/repository";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("서비스") };
}
export default async function Page() {
  return <ServicesList rows={await resourceRepository.listServices()} />;
}
