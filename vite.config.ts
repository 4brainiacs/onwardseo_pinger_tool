import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'terser',
    sourcemap: false,
    target: 'es2019',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: false,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        manualChunks: undefined
      },
      onwarn(warning, warn) {
        if (warning.code === 'CIRCULAR_DEPENDENCY') return;
        warn(warning);
      }
    }
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    fs: {
      strict: false,
      allow: ['.']
    }
  },
  preview: {
    port: 4173,
    strictPort: true,
    host: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom']
  }
});