import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'overlay',
  base: './',
  build: {
    outDir: '../dist/overlay',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'overlay/overlay.html'),
    },
  },
});
