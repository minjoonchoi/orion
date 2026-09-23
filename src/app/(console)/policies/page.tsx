import { PoliciesList } from "@/features/access/screens";
import { accessRepository } from "@/features/access/repository";
export const metadata = { title: "정책" };
export default async function Page() {
  return <PoliciesList rows={await accessRepository.listPolicies()} />;
}
