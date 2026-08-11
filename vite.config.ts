import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        // `as const` porque com `strict` o TS alarga `true` para `boolean`, e o Vite só aceita
        // `true | string[]` aqui. O comportamento é o mesmo: libera qualquer host no dev server.
        allowedHosts: true as const,
      },
      plugins: [react()],
      build: {
        // Firestore (usado por todo mundo, direto) isolado do Auth (usado por todo mundo,
        // mas só depois do primeiro paint) e do Storage (só quem realmente entra em telas
        // de upload — Painel, modais de admin — baixa esse chunk). Evita que um visitante
        // anônimo precise carregar o SDK de upload de imagens só pra ler uma ficha.
        chunkSizeWarningLimit: 800,
        rollupOptions: {
          output: {
            manualChunks: {
              firebase: ['firebase/app', 'firebase/firestore'],
              'firebase-auth': ['firebase/auth'],
              'firebase-storage': ['firebase/storage'],
            },
          },
        },
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
