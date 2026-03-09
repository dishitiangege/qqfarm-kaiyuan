import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: '/',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:6001',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/tools': {
        target: 'http://localhost:6001',
        changeOrigin: true,
        secure: false,
      },
      '/gameConfig': {
        target: 'http://localhost:6001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },

})
