import { ServiceAccountsList } from "@/features/service-accounts/screens";
import { serviceAccountRepository } from "@/features/service-accounts/repository";
export const metadata = { title: "서비스 어카운트" };
export default async function Page() {
  return (
    <ServiceAccountsList rows={await serviceAccountRepository.listAccounts()} />
  );
}
