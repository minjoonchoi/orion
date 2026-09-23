import { ApiKeysList } from "@/features/api-keys/screens";
import { apiKeyRepository } from "@/features/api-keys/repository";
export const metadata = { title: "API 키" };
export default async function Page() {
  return <ApiKeysList rows={await apiKeyRepository.listKeys()} />;
}
