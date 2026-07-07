import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const datajudKey = env.VITE_DATAJUD_API_KEY || env.DATAJUD_API_KEY || '';
  const tribunalScraperTarget =
    env.VITE_TRIBUNAL_SCRAPER_DEV_PROXY_TARGET || 'http://localhost:5288';

  return {
    plugins: [
      react(),
      tailwindcss(),
      nodePolyfills({
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
    build: {
      // iOS Safari antigo (e cache de chunks após deploy) — evita SyntaxError silencioso / tela branca.
      target: ['es2020', 'safari14', 'chrome87', 'firefox78'],
      cssTarget: 'safari14',
    },
    resolve: {
      alias: {
        buffer: 'buffer/',
        events: 'events/',
      },
    },
    optimizeDeps: {
      include: ['buffer', 'events', 'officecrypto-tool', 'xml2js', 'sax', 'cfb'],
    },
    server: {
      host: true,
      proxy: {
        '/api': {
          // Backend Docker expõe 8081; Spring local (mvnw) usa 8080. Override: VITE_DEV_API_PROXY_TARGET
          target: env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:8080',
          changeOrigin: true,
        },
        '/datajud-proxy': {
          target: 'https://api-publica.datajud.cnj.jus.br',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/datajud-proxy/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (datajudKey) {
                proxyReq.setHeader('Authorization', `APIKey ${datajudKey}`);
              }
            });
          },
        },
        /** API .NET Vilareal.TribunalScraper.Api — só usada se não houver VITE_TRIBUNAL_SCRAPER_URL absoluta. */
        '/tribunal-scraper-api': {
          target: tribunalScraperTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/tribunal-scraper-api/, ''),
        },
      },
    },
  };
});
