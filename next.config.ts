import type { NextConfig } from "next";

// Next.js blocks cross-origin dev-server requests (including the HMR
// websocket) by default — only localhost is trusted out of the box. The
// "Network:" URL `next dev` prints for testing on a phone over the same
// Wi-Fi isn't allowed automatically, which silently breaks React's
// interactivity on that URL (HMR fails, so nothing ever hydrates properly)
// while native HTML controls (selects, text inputs) still *look* like they
// work. Read from .env.local (machine-specific, gitignored — see
// .env.example) rather than hardcoding it, since it's specific to
// whoever's testing on their own network, not something to publish.
const allowedDevOrigins = process.env.DEV_LAN_IP ? [process.env.DEV_LAN_IP] : undefined;

const nextConfig: NextConfig = {
  allowedDevOrigins,
};

export default nextConfig;
