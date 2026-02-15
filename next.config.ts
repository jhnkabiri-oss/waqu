import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@whiskeysockets/baileys',
    'jimp',
    'sharp',
    'pino',
    'bullmq',
    'ioredis',
    'googleapis',
  ],
  turbopack: {
    resolveAlias: {
      // Baileys optional deps that don't need to be bundled
      'jimp': { browser: '' },
      'sharp': { browser: '' },
    },
  },
};

export default nextConfig;
