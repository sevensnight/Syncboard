import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build into client/build so the existing Express server can serve it.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build',
    emptyOutDir: true,
  },
  server: {
    port: 3005,
    proxy: {
      '/socket.io': {
        target: 'http://127.0.0.1:3003',
        ws: true,
      },
    },
  },
});
