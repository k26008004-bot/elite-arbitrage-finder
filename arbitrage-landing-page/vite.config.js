import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
  },
  build: {
    chunkSizeWarningLimit: 1600, // Increased limit to prevent Vercel CI failures due to recharts size
  }
})
