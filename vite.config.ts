import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GH_PAGES === 'true' ? '/Writer-s-Organizer/' : '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    host: '127.0.0.1',
    hmr: process.env.DISABLE_HMR !== 'true',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/debug-save' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              fs.writeFileSync(path.resolve(__dirname, 'debug_state.json'), body);
            } catch (err) {
              console.error('Failed to write debug file', err);
            }
            res.statusCode = 200;
            res.end('OK');
          });
        } else {
          next();
        }
      });
    },
  },
});
