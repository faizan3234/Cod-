import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/.netlify/functions': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: false,
      },
    },
  },
  build: { target: 'es2022' },
});
