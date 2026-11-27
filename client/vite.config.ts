import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || './',
  plugins: [
    react(),
    {
      // The live-only web build is not a sample, so its page description says so
      name: 'live-description',
      transformIndexHtml(html: string) {
        if (process.env.VITE_LIVE_DEFAULT !== 'true') return html;
        return html.split('Clear your inbox, one email at a time. Try it on a sample inbox.').join('Your email as chats, read only.');
      },
    },
  ],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3456',
        changeOrigin: true,
      },
    },
  },
});
