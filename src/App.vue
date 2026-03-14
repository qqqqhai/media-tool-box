<template>
  <div class="app-container">
    <!-- 侧边导航栏 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2>离线多媒体工具箱</h2>
        <p>零上传·批量处理</p>
      </div>
      
      <!-- 导航菜单 -->
      <el-menu
        :default-active="activeMenu"
        class="sidebar-menu"
        background-color="transparent"
        text-color="#333"
        active-text-color="#409eff"
        @select="handleMenuChange"
      >
        <!-- 图片处理模块分组 -->
        <el-sub-menu index="image-group">
          <template #title>
            <el-icon><Picture /></el-icon>
            <span>图片处理</span>
          </template>
          <el-menu-item index="image-convert">图片格式转换</el-menu-item>
          <el-menu-item index="image-compress">图片批量压缩</el-menu-item>
          <el-menu-item index="image-resize">图片尺寸调整</el-menu-item>
        </el-sub-menu>

        <!-- 音频处理模块分组 -->
        <el-sub-menu index="audio-group">
          <template #title>
            <el-icon><Headset /></el-icon>
            <span>音频处理</span>
          </template>
          <el-menu-item index="audio-convert">音频格式转换</el-menu-item>
          <el-menu-item index="audio-trim">音频片段裁剪</el-menu-item>
          <el-menu-item index="audio-volume">音频音量调整</el-menu-item>
          <el-menu-item index="audio-extract">视频提取音频</el-menu-item>
        </el-sub-menu>

        <!-- 测试demo菜单，后续可以删掉 -->
        <el-sub-menu index="test-group">
          <template #title>
            <el-icon><Tools /></el-icon>
            <span>测试验证</span>
          </template>
          <el-menu-item index="test-ffmpeg">ffmpeg核心验证</el-menu-item>
          <el-menu-item index="test-worker">Worker非阻塞验证</el-menu-item>
        </el-sub-menu>

        <!-- 后续音频、视频模块，第三阶段再添加 -->
      </el-menu>
    </aside>

    <!-- 主内容区域 -->
    <main class="main-content">
      <!-- 顶部操作栏 -->
      <header class="content-header">
        <h3>{{ currentMenuTitle }}</h3>
      </header>

      <!-- 功能模块内容区，根据菜单切换对应组件 -->
      <div class="content-body">
        <!-- 图片处理4个核心功能 -->
        <ImageConvert v-if="activeMenu === 'image-convert'" />
        <ImageCompress v-if="activeMenu === 'image-compress'" />
        <ImageResize v-if="activeMenu === 'image-resize'" />
        <!-- 音频处理4个功能模块 -->
        <AudioConvert v-if="activeMenu === 'audio-convert'" />
        <AudioTrim v-if="activeMenu === 'audio-trim'" />
        <AudioVolume v-if="activeMenu === 'audio-volume'" />
        <AudioExtract v-if="activeMenu === 'audio-extract'" />
        <!-- 测试demo -->
        <TestFfmpeg v-if="activeMenu === 'test-ffmpeg'" />
        <TestWorker v-if="activeMenu === 'test-worker'" />
      </div>
    </main>
  </div>
</template>

<script setup>
// 导入Vue核心API
import { ref, computed } from 'vue'
// 导入Element Plus图标
import { Picture, Tools, Headset } from '@element-plus/icons-vue'
// 导入所有功能组件
import TestFfmpeg from './components/TestFfmpeg.vue'
import TestWorker from './components/TestWorker.vue'
import ImageConvert from './components/image/ImageConvert.vue'
import ImageCompress from './components/image/ImageCompress.vue'
import ImageResize from './components/image/ImageResize.vue'
// 导入音频处理模块组件
import AudioConvert from './components/audio/AudioConvert.vue'
import AudioTrim from './components/audio/AudioTrim.vue'
import AudioVolume from './components/audio/AudioVolume.vue'
import AudioExtract from './components/audio/AudioExtract.vue'
// 响应式状态
const activeMenu = ref('image-convert') // 默认选中图片格式转换
// 菜单标题映射
const menuTitleMap = {
  'image-convert': '图片格式转换',
  'image-compress': '图片批量压缩',
  'image-resize': '图片尺寸调整',
  
  'audio-convert': '音频格式转换',
  'audio-trim': '音频片段裁剪',
  'audio-volume': '音频音量调整',
  'audio-extract': '视频提取音频',

  'test-ffmpeg': 'ffmpeg核心能力验证',
  'test-worker': 'Web Worker非阻塞验证'
}


// 计算当前菜单标题
const currentMenuTitle = computed(() => menuTitleMap[activeMenu.value])

// 菜单切换事件
const handleMenuChange = (index) => {
  activeMenu.value = index
}
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
.app-container {
  display: flex;
  width: 100vw;
  height: 100vh;
  background-color: #f5f7fa;
  overflow: hidden;
}
/* 侧边栏样式 */
.sidebar {
  width: 240px;
  height: 100%;
  background-color: #fff;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
}
.sidebar-header {
  padding: 20px 16px;
  border-bottom: 1px solid #e4e7ed;
}
.sidebar-header h2 {
  font-size: 18px;
  color: #303133;
  margin-bottom: 4px;
}
.sidebar-header p {
  font-size: 12px;
  color: #909399;
}
.sidebar-menu {
  flex: 1;
  border: none;
  margin-top: 10px;
}
/* 主内容区样式 */
.main-content {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.content-header {
  height: 60px;
  padding: 0 20px;
  background-color: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
}
.content-header h3 {
  font-size: 18px;
  color: #303133;
  font-weight: 500;
}
.content-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}
/* 修复菜单展开样式 */
:deep(.el-sub-menu__title) {
  height: 50px;
  line-height: 50px;
}
:deep(.el-menu-item) {
  height: 50px;
  line-height: 50px;
}
</style>