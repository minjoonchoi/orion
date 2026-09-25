import { EndpointsList } from "@/features/resources/screens";
import { resourceRepository } from "@/features/resources/repository";
export const metadata = { title: "서비스 엔드포인트" };
export default async function Page() {
  return (
    <EndpointsList
      rows={await resourceRepository.listEndpoints()}
      services={await resourceRepository.listServices()}
    />
  );
}
