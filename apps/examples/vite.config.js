import { useworkerVite } from '@mileszim/useworker-vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), useworkerVite()],
  root: '.',
  build: {
    outDir: '../dist',
  },
})
