import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { EndpointsList } from "@/features/resources/screens";
import { resourceRepository } from "@/features/resources/repository";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("서비스 엔드포인트") };
}
export default async function Page() {
  return (
    <EndpointsList
      rows={await resourceRepository.listEndpoints()}
      services={await resourceRepository.listServices()}
    />
  );
}
