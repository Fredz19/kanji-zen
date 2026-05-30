import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// PENTING: Karena menggunakan custom domain (www.kanjizen.my.id),
// base harus diatur ke '/' (root) agar aset dapat terbaca dengan benar.
export default defineConfig({
  plugins: [react()],
  base: '/',
})
