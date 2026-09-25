import { ServicesList } from "@/features/resources/screens";
import { resourceRepository } from "@/features/resources/repository";
export const metadata = { title: "서비스" };
export default async function Page() {
  return <ServicesList rows={await resourceRepository.listServices()} />;
}
