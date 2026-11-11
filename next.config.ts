import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/forms/eco/*": ["./assets/fonts/*.ttf"],
    "/api/forms/adhesion-leak-test/*": ["./assets/fonts/*.ttf"],
    "/api/forms/development-inspection/*": ["./assets/fonts/*.ttf"],
    "/api/forms/shelf-product-inspection/export": ["./assets/fonts/*.ttf"],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
