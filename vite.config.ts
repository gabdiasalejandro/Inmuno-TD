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
    // Phaser is a single large dependency; keep it in its own chunk so a deploy that only
    // changes game code leaves it cached in the browser.
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'phaser', test: /node_modules[\\/].*phaser/ }],
        },
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
