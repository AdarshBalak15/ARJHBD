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
        passes: 2,              // Run compression twice for better results
      },
      mangle: {
        safari10: true,         // Work around Safari 10 bugs
      },
    },
    // Code splitting configuration
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Three.js ecosystem — largest dependency, isolate for caching
          if (id.includes('three') || id.includes('@react-three')) {
            return 'three-vendor'
          }
          // Animation libraries
          if (id.includes('framer-motion') || id.includes('gsap')) {
            return 'animation-vendor'
          }
          // Particles engine
          if (id.includes('tsparticles') || id.includes('@tsparticles')) {
            return 'particles-vendor'
          }
          // React core — shared across all chunks
          if (id.includes('react-dom') || id.includes('/react/')) {
            return 'react-vendor'
          }
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
    // Target modern browsers for smaller output
    target: 'es2020',
  },
  // Proxy during local dev — requires `npm run server:dev` on port 3001
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      // Proxy Netlify function calls to Express during local dev
      '/.netlify/functions/login': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => '/api/auth/login',
      },
      '/.netlify/functions/track': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => '/api/track-user',
      },
    },
  },
  // Optimize dependency pre-bundling  
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion'],
  },
})
