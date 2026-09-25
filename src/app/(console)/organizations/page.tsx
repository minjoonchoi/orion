import { OrganizationsList } from "@/features/identity/screens";
import { identityRepository } from "@/features/identity/repository";
export const metadata = { title: "조직" };
export default async function Page() {
  return (
    <OrganizationsList rows={await identityRepository.listOrganizations()} />
  );
}
