import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["aws-iot-device-sdk-v2", "aws-crt", "pg"],
};

export default nextConfig;
