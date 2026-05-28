import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// PENTING: base harus sama persis dengan nama repo GitHub kamu
// Contoh: repo bernama "kanji-zen" → base: '/kanji-zen/'
export default defineConfig({
  plugins: [react()],
  base: '/kanji-zen/',
})
