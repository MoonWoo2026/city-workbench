import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  // 仅构建时用 GitHub Pages 子路径；本地 dev 保持根路径
  base: command === 'build' ? '/city-workbench/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: true, // 允许 cloudflared 临时隧道域名访问（仅本地开发）
  },
}))
