import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Next blocks dev-server assets and the HMR socket when the request comes
   * from an origin other than localhost. Testing the QR flow means opening
   * the app from a phone on the same wifi, by LAN IP — which is exactly that
   * case, and shows up as 403s on /_next/static and a dead HMR socket.
   *
   * Private ranges only, and development only: `next build` ignores this.
   */
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*", "*.local"],
};

export default nextConfig;
