import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In development the Vite server proxies API, upload, sitemap and robots requests
// to Express, so the browser talks to a single origin and cookies just work.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_PROXY || 'http://localhost:5000';
  const proxyError = (_error, _request, response) => {
    if (response.headersSent) return;
    response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'The API is unavailable. Start MySQL and the backend, then refresh.' }));
  };
  const proxied = { target, changeOrigin: false, configure: (proxy) => proxy.on('error', proxyError) };
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': proxied,
        '/uploads': proxied,
        '/sitemap.xml': proxied,
        '/robots.txt': proxied,
      },
    },
    preview: { port: 4173 },
    build: {
      target: 'es2020',
      sourcemap: false,
      chunkSizeWarningLimit: 600,
    },
  };
});
