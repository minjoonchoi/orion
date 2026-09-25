import { WorkspacesList } from "@/features/resources/screens";
import { resourceRepository } from "@/features/resources/repository";
export const metadata = { title: "워크스페이스" };
export default async function Page() {
  return <WorkspacesList rows={await resourceRepository.listWorkspaces()} />;
}
