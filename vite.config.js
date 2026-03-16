import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base:'/media-tool-box/',
  plugins: [vue()],
  // 配置跨域隔离响应头，解决ffmpeg所需的API权限问题
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  // 排除ffmpeg相关依赖，避免Vite依赖优化器的问题
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  }
})