import type { NextConfig } from "next";

const pdfKitAssets = [
  "./node_modules/pdfkit/js/data/**/*.afm",
  "./public/assets/logo-polman.png",
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/export/meetings/[meetingId]": pdfKitAssets,
    "/api/export/invitations/[formId]": pdfKitAssets,
    "/api/export/**/*": pdfKitAssets,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
      config.resolve.alias = {
        ...config.resolve.alias,
        encoding: false,
      };
    }

    return config;
  },
};

export default nextConfig;