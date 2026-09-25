import "server-only";
import { deployment, listData, detailData } from "@/lib/api/server";
type Repository = typeof import("./repository.mock").apiKeyRepository;
export const apiKeyRepository: Repository = {
  async listKeys() {
    if (deployment().mode === "demo")
      return (await import("./repository.mock")).apiKeyRepository.listKeys();
    return listData("api-keys");
  },
  async getKey(id: string) {
    if (deployment().mode === "demo")
      return (await import("./repository.mock")).apiKeyRepository.getKey(id);
    return detailData("api-keys", id);
  },
};
