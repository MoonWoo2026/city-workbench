import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // GitHub Pages 部署在 /city-workbench/ 子路径下
  base: '/city-workbench/',
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: true, // 允许 cloudflared 临时隧道域名访问（仅本地开发）
  },
})
