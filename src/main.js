// Vue核心导入
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

// Element Plus 全局引入
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

// 创建Vue实例
const app = createApp(App)

// 全局注册所有Element Plus图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 挂载Element Plus
app.use(ElementPlus)

// 挂载应用
app.mount('#app')
