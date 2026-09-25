import { PagesList } from "@/features/resources/screens";
import { resourceRepository } from "@/features/resources/repository";
export const metadata = { title: "페이지" };
export default async function Page() {
  return (
    <PagesList
      rows={await resourceRepository.listPages()}
      workspaces={await resourceRepository.listWorkspaces()}
    />
  );
}
