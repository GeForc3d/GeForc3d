import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Single-file build for publishing as an Artifact.
 *
 * An Artifact is one HTML document with a hard size ceiling and a content
 * policy that blocks fetch, so the bundled MediaPipe model and WASM runtime
 * (27MB between them) cannot come along. Live pose guidance is therefore off in
 * this build, and the app is told so at compile time rather than being left to
 * fail at runtime and report a vaguer error.
 *
 * Everything else — discovery, search, the catalogue, pose previews, the
 * camera, and the manual guide — is the same code as the deployed build.
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __VISION_AVAILABLE__: 'false',
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: 'dist-artifact',
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
