import { RolesList } from "@/features/access/screens";
import { accessRepository } from "@/features/access/repository";
export const metadata = { title: "역할" };
export default async function Page() {
  return <RolesList rows={await accessRepository.listRoles()} />;
}
