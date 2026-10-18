import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { host: '127.0.0.1', proxy: { '/api': 'http://127.0.0.1:4174' } },
  ...(mode === 'demo' ? { build: { rollupOptions: { input: './demo.html' } } } : {}),
  test: { environment: 'jsdom', setupFiles: './src/test-setup.ts' }
}));
