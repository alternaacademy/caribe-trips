import { URL, fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // `host: true` exposes the dev server on the LAN so an Android device can
    // reach it during Task 22.
    host: true,
    port: 5173,
  },
});
