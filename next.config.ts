import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/*": ["./config/resources/orion-resources.yaml"],
  },
  poweredByHeader: false,
};
export default nextConfig;
