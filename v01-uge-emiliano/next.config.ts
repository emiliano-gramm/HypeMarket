import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["aws-iot-device-sdk-v2", "aws-crt"],
};

export default nextConfig;
