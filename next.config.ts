import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/*": [
      "./config/resources/orion-resources.yaml",
      "./config/policies/orion-policies.yaml",
    ],
  },
  poweredByHeader: false,
};
export default nextConfig;
