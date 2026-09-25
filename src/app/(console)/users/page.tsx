import { UsersList } from "@/features/identity/screens";
import { identityRepository } from "@/features/identity/repository";
export const metadata = { title: "사용자" };
export default async function Page() {
  return (
    <UsersList
      rows={await identityRepository.listUsers()}
      organizations={await identityRepository.listOrganizations()}
    />
  );
}
