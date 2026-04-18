import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteCompression from 'vite-plugin-compression'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Gzip compression for production builds
    viteCompression({
      algorithm: 'gzip',
      threshold: 1024, // Only compress files > 1KB
      ext: '.gz',
    }),
    // Brotli compression for production builds
    viteCompression({
      algorithm: 'brotliCompress',
      threshold: 1024,
      ext: '.br',
    }),
  ],
  build: {
    // Enable minification with terser for better compression
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,     // Remove all console.* calls
        drop_debugger: true,    // Remove debugger statements
        pure_funcs: ['console.log', 'console.warn', 'console.info'],
      },
    },
    // Code splitting configuration
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          'react-vendor': ['react', 'react-dom'],
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
          'animation-vendor': ['framer-motion', 'gsap'],
        },
      },
    },
    // Enable CSS code splitting
    cssCodeSplit: true,
    // No source maps in production
    sourcemap: false,
    // Chunk size warning limit
    chunkSizeWarningLimit: 600,
    // Asset inlining threshold (4KB)
    assetsInlineLimit: 4096,
  },
  // Proxy during local dev
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Proxy Netlify function calls to Express during local dev
      '/.netlify/functions/login': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => '/api/auth/login',
      },
    },
  },
  // Optimize dependency pre-bundling  
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion'],
  },
})
