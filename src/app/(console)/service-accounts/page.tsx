import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { ServiceAccountsList } from "@/features/service-accounts/screens";
import { serviceAccountRepository } from "@/features/service-accounts/repository";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("서비스 어카운트") };
}
export default async function Page() {
  return (
    <ServiceAccountsList rows={await serviceAccountRepository.listAccounts()} />
  );
}
