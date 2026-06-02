import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // expose to all network interfaces (0.0.0.0)
    port: 5173,
    proxy: {
      '/api/paybolt': {
        target: 'https://www.paybolt.online',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/paybolt/, '/api'),
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
