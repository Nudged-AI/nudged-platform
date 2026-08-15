import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const target = process.env.BUILD_TARGET;

export default defineConfig(() => {
  if (target === 'background') {
    return {
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        rollupOptions: {
          input: resolve(__dirname, 'src/background.ts'),
          output: {
            entryFileNames: 'background.js',
            format: 'iife' as const,
            inlineDynamicImports: true,
          },
        },
      },
    };
  }

  if (target === 'content') {
    return {
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        rollupOptions: {
          input: resolve(__dirname, 'src/content.ts'),
          output: {
            entryFileNames: 'content.js',
            format: 'iife' as const,
            inlineDynamicImports: true,
          },
        },
      },
    };
  }

  // Default: full PWA + popup build
  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          popup: resolve(__dirname, 'popup.html'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name]-[hash].js',
          assetFileNames: '[name].[ext]',
        },
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
