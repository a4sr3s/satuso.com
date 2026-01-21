import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core - loaded on every page
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // TanStack Query - data fetching
          'vendor-query': ['@tanstack/react-query'],
          // UI utilities
          'vendor-ui': ['lucide-react', 'clsx'],
          // State management
          'vendor-state': ['zustand'],
          // Date handling
          'vendor-date': ['date-fns'],
          // Charts
          'vendor-charts': ['recharts'],
          // Drag and drop
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable'],
        },
      },
    },
    // Increase chunk size warning limit since we're intentionally splitting
    chunkSizeWarningLimit: 300,
  },
});
