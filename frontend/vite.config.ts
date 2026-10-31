import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/chat': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/auth': 'http://localhost:8000',
      '/tasks': 'http://localhost:8000',
      '/settings': 'http://localhost:8000',
      '/loops': 'http://localhost:8000',
      '/system': 'http://localhost:8000',
    },
  },
})
