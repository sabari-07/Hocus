import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type UserConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Shared Vite config for every Hocus app: React, Tailwind v4, and an installable PWA that caches
 * the self-hosted MediaPipe model + WASM so the app works offline after the first load.
 */
export function hocusVite(o: { name: string; short: string; port: number }): UserConfig {
  return defineConfig({
    base: process.env.HOCUS_BASE ?? '/',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: o.name,
          short_name: o.short,
          theme_color: '#0E0B14',
          background_color: '#0E0B14',
          display: 'standalone',
          icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,woff2,task,wasm}'],
          // Only the non-module WASM build is loaded by FilesetResolver; don't cache the other 15 MB copy.
          globIgnores: ['**/vision_wasm_module_internal.*'],
          maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        },
      }),
    ],
    server: { port: o.port, strictPort: true },
    preview: { port: o.port, strictPort: true },
    build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  }) as UserConfig;
}
