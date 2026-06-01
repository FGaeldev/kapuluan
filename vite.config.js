import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  worker: {
    // Vite handles Web Workers natively — this enables proper bundling
    format: 'es',
  },
})