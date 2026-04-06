import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vercel serves from the domain root, while GitHub Pages serves from /leafspots/.
  base: process.env.VERCEL === '1' ? '/' : '/leafspots/',
})
