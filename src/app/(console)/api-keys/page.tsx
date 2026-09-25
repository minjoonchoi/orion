import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { ApiKeysList } from "@/features/api-keys/screens";
import { apiKeyRepository } from "@/features/api-keys/repository";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("API 키") };
}
export default async function Page() {
  return <ApiKeysList rows={await apiKeyRepository.listKeys()} />;
}
