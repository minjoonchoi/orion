import { sha256 } from "@noble/hashes/sha256";
export const randomUUID = () => crypto.randomUUID();
export function createHash(algorithm) {
  if (algorithm !== "sha256") throw Error("Unsupported hash");
  const hash = sha256.create();
  return {
    update(value) {
      hash.update(new TextEncoder().encode(value));
      return this;
    },
    digest(encoding) {
      if (encoding !== "hex") throw Error("Unsupported encoding");
      return Array.from(hash.digest(), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
    },
  };
}
