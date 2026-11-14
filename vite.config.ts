import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works from any static host path.
  base: './',
  server: {
    // Listen on every interface and accept Cloudflare quick-tunnel hostnames, so the dev
    // server can be opened from a phone through `cloudflared tunnel --url`.
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ['.trycloudflare.com'],
  },
  build: {
    target: 'es2022',
    // Phaser is a single large dependency; keep it in its own chunk.
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
