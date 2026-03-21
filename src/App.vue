<template>
  <div class="app-container" :class="{ 'dark-theme': isDarkTheme }">
    <!-- 侧边导航栏 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2>离线多媒体工具箱</h2>
        <p>零上传·批量处理</p>
        <div class="theme-toggle">
          <el-button 
            type="text" 
            @click="toggleTheme"
            :icon="isDarkTheme ? Sunny : Moon"
            size="small"
          >
            {{ isDarkTheme ? '切换亮色' : '切换暗色' }}
          </el-button>
        </div>
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
        <!-- 视频处理模块分组 -->
        <el-sub-menu index="video-group">
          <template #title>
            <el-icon><VideoCamera /></el-icon>
            <span>视频处理</span>
          </template>
          <el-menu-item index="video-convert">视频格式转换</el-menu-item>
          <el-menu-item index="video-compress">视频批量压缩</el-menu-item>
          <el-menu-item index="video-trim">视频片段裁剪</el-menu-item>
          <el-menu-item index="video-to-gif">视频转GIF</el-menu-item>
        </el-sub-menu>

        <!-- 测试demo菜单 -->
        <el-sub-menu index="test-group">
          <template #title>
            <el-icon><Tools /></el-icon>
            <span>测试验证</span>
          </template>
          <el-menu-item index="test-ffmpeg">ffmpeg核心验证</el-menu-item>
          <el-menu-item index="test-worker">Worker非阻塞验证</el-menu-item>
        </el-sub-menu>

        
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

        <!-- 视频处理5个功能模块 -->
        <VideoConvert v-if="activeMenu === 'video-convert'" />
        <VideoCompress v-if="activeMenu === 'video-compress'" />
        <VideoTrim v-if="activeMenu === 'video-trim'" />
        <VideoToGif v-if="activeMenu === 'video-to-gif'" />
        <!-- 测试demo -->
        <TestFfmpeg v-if="activeMenu === 'test-ffmpeg'" />
        <TestWorker v-if="activeMenu === 'test-worker'" />
      </div>
    </main>
  </div>
</template>

<script setup>
// 导入Vue核心API
import { ref, computed, watch } from 'vue'
// 导入Element Plus图标
import { Picture, Tools, Headset, VideoCamera, Moon, Sunny } from '@element-plus/icons-vue'
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
// 导入视频处理模块组件
import VideoConvert from './components/video/VideoConvert.vue'
import VideoCompress from './components/video/VideoCompress.vue'
import VideoTrim from './components/video/VideoTrim.vue'
import VideoToGif from './components/video/VideoToGif.vue'
// 响应式状态
const activeMenu = ref('image-convert') // 默认选中图片格式转换
const isDarkTheme = ref(localStorage.getItem('isDarkTheme') === 'true') // 从localStorage读取主题设置

// 主题切换方法
const toggleTheme = () => {
  isDarkTheme.value = !isDarkTheme.value
}

// 监听主题变化，保存到localStorage
watch(isDarkTheme, (newValue) => {
  localStorage.setItem('isDarkTheme', newValue.toString())
})

// 菜单标题映射
const menuTitleMap = {
  'image-convert': '图片格式转换',
  'image-compress': '图片批量压缩',
  'image-resize': '图片尺寸调整',
  
  'audio-convert': '音频格式转换',
  'audio-trim': '音频片段裁剪',
  'audio-volume': '音频音量调整',
  'audio-extract': '视频提取音频',

   'video-convert': '视频格式转换',
  'video-compress': '视频批量压缩',
  'video-trim': '视频片段裁剪',
  'video-to-gif': '视频转GIF',

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
  overflow-y: auto;
  max-height: calc(100% - 100px);
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

/* 主题切换相关样式 */
.theme-toggle {
  margin-top: 10px;
  text-align: center;
}

/* 暗色主题样式 - 黑金配色 */
.dark-theme {
  background-color: #0a0a0a;
  color: #d0d0d0;
}

.dark-theme .sidebar {
  background-color: #121212;
  border-right: 1px solid #2a2a2a;
}

.dark-theme .sidebar-header {
  border-bottom: 1px solid #2a2a2a;
}

.dark-theme .sidebar-header h2 {
  color: #f0f0f0;
}

.dark-theme .sidebar-header p {
  color: #a0a0a0;
}

.dark-theme .main-content {
  background-color: #0a0a0a;
}

.dark-theme .content-header {
  background-color: #121212;
  border-bottom: 1px solid #2a2a2a;
}

.dark-theme .content-header h3 {
  color: #f0f0f0;
}

/* 暗色主题下的Element Plus组件样式 */
.dark-theme :deep(.el-menu) {
  background-color: #121212;
}

.dark-theme :deep(.el-menu-item) {
  color: #d0d0d0;
}

.dark-theme :deep(.el-menu-item:hover) {
  background-color: #1a1a1a;
}

.dark-theme :deep(.el-menu-item.is-active) {
  background-color: #5c543c;
  color: #0a0a0a;
}

.dark-theme :deep(.el-sub-menu__title) {
  color: #d0d0d0;
}

.dark-theme :deep(.el-sub-menu__title:hover) {
  background-color: #1a1a1a;
}

/* 暗色主题下的卡片样式 */
.dark-theme :deep(.el-card) {
  background-color: #121212;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.3);
}

.dark-theme :deep(.el-card__header) {
  background-color: #1a1a1a;
  border-bottom: 1px solid #2a2a2a;
  border-radius: 8px 8px 0 0;
}

.dark-theme :deep(.el-card__header span) {
  color: #f0f0f0;
  font-weight: 500;
}

/* 暗色主题下的表单样式 */
.dark-theme :deep(.el-form-item__label) {
  color: #d0d0d0;
}

.dark-theme :deep(.el-input__wrapper) {
  background-color: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
}

.dark-theme :deep(.el-input__input) {
  color: #d0d0d0;
}

.dark-theme :deep(.el-input__wrapper.is-focus) {
  border-color:#5c543c;
  box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.2);
}

/* 暗色主题下的按钮样式 */
.dark-theme :deep(.el-button--primary) {
  background-color: #5c543c;
  border-color: #5c543c;
  color: #0a0a0a;
  border-radius: 6px;
  font-weight: 500;
}

.dark-theme :deep(.el-button--primary:hover) {
  background-color:#5c543c;
  border-color:#5c543c;
  color: #0a0a0a;
}

.dark-theme :deep(.el-button--default) {
  background-color: #1a1a1a;
  border-color: #2a2a2a;
  color: #d0d0d0;
  border-radius: 6px;
}

.dark-theme :deep(.el-button--default:hover) {
  background-color: #232323;
  border-color: #333333;
  color: #d0d0d0;
}

.dark-theme :deep(.el-button--text) {
  color: #d0d0d0;
}

.dark-theme :deep(.el-button--text:hover) {
  color: #5c543c;
}

/* 暗色主题下的提示信息样式 */
.dark-theme :deep(.el-message) {
  background-color: #1a1a1a;
  border: 1px solid #2a2a2a;
  color: #d0d0d0;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.dark-theme :deep(.el-message--success) {
  background-color: #1a2a20;
  border-color: #2d5a3d;
  color: #d0d0d0;
}

.dark-theme :deep(.el-message--warning) {
  background-color: #2a251a;
  border-color: #d4af37;
  color: #d0d0d0;
}

.dark-theme :deep(.el-message--error) {
  background-color: #2a1a1a;
  border-color: #5a2a2a;
  color: #d0d0d0;
}

/* 暗色主题下的选择器样式 */
.dark-theme :deep(.el-select .el-input__wrapper) {
  background-color: #1a1a1a;
  border: 1px solid #2a2a2a;
}

.dark-theme :deep(.el-select-dropdown) {
  background-color: #121212;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.dark-theme :deep(.el-select-dropdown__item) {
  color: #d0d0d0;
}

.dark-theme :deep(.el-select-dropdown__item:hover) {
  background-color: #1a1a1a;
}

.dark-theme :deep(.el-select-dropdown__item.selected) {
  background-color: #d4af37;
  color: #0a0a0a;
}

/* 暗色主题下的进度条样式 */
.dark-theme :deep(.el-progress__bar) {
  background-color: #1a1a1a;
}

.dark-theme :deep(.el-progress__bar__inner) {
  background-color: #d4af37;
}

/* 暗色主题下的滑块样式 */
.dark-theme :deep(.el-slider__runway) {
  background-color: #1a1a1a;
}

.dark-theme :deep(.el-slider__bar) {
  background-color: #d4af37;
}

.dark-theme :deep(.el-slider__button) {
  border-color: #d4af37;
  background-color: #121212;
}

.dark-theme :deep(.el-slider__button:hover) {
  border-color: #b89326;
  box-shadow: 0 0 0 5px rgba(212, 175, 55, 0.1);
}

/* 暗色主题下的时间选择器样式 */
.dark-theme :deep(.el-time-picker__panel) {
  background-color: #121212;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.dark-theme :deep(.el-time-picker__header) {
  background-color: #1a1a1a;
  border-bottom: 1px solid #2a2a2a;
}

.dark-theme :deep(.el-time-picker__content) {
  color: #d0d0d0;
}

.dark-theme :deep(.el-time-picker__item:hover) {
  background-color: #1a1a1a;
}

.dark-theme :deep(.el-time-picker__item.selected) {
  color: #d4af37;
}

/* 暗色主题下的单选框和复选框 */
.dark-theme :deep(.el-radio__input.is-checked .el-radio__inner) {
  background-color: #d4af37;
  border-color: #d4af37;
}

.dark-theme :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background-color: #d4af37;
  border-color: #d4af37;
}

/* 暗色主题下的分页 */
.dark-theme :deep(.el-pagination__item) {
  background-color: #1a1a1a;
  border: 1px solid #2a2a2a;
  color: #d0d0d0;
}

.dark-theme :deep(.el-pagination__item:hover) {
  background-color: #232323;
  border-color: #333333;
}

.dark-theme :deep(.el-pagination__item.is-active) {
  background-color: #d4af37;
  border-color: #d4af37;
  color: #0a0a0a;
}

/* 暗色主题下的标签 */
.dark-theme :deep(.el-tag) {
  background-color: #1a1a1a;
  border: 1px solid #2a2a2a;
  color: #d0d0d0;
}

.dark-theme :deep(.el-tag--primary) {
  background-color: #d4af37;
  border-color: #d4af37;
  color: #0a0a0a;
}

/* 暗色主题下的 FileUploadList 组件样式 */
.dark-theme :deep(.upload-icon) {
  color: #d4af37;
}

.dark-theme :deep(.upload-text) {
  color: #d0d0d0;
}

.dark-theme :deep(.upload-tip) {
  color: #a0a0a0;
}

.dark-theme :deep(.el-upload-dragger) {
  background-color: #121212;
  border: 2px dashed #2a2a2a;
}

.dark-theme :deep(.el-upload-dragger:hover) {
  background-color: #1a1a1a;
  border-color: #d4af37;
}

.dark-theme :deep(.list-header) {
  color: #d0d0d0;
}

.dark-theme :deep(.file-card) {
  background-color: #121212;
  border: 1px solid #2a2a2a;
}

.dark-theme :deep(.file-card:hover) {
  box-shadow: 0 2px 12px rgba(212, 175, 55, 0.2);
  border-color: #d4af37;
}

.dark-theme :deep(.file-thumbnail) {
  background-color: #1a1a1a;
}

.dark-theme :deep(.media-placeholder) {
  background-color: #1a1a1a;
  color: #a0a0a0;
}

.dark-theme :deep(.file-name) {
  color: #d0d0d0;
}

.dark-theme :deep(.file-size) {
  color: #a0a0a0;
}

.dark-theme :deep(.result-size) {
  color: #d4af37;
}

/* 暗色主题下的状态标签 */
.dark-theme :deep(.status-tag.pending) {
  background-color: #555555;
  color: #d0d0d0;
}

.dark-theme :deep(.status-tag.processing) {
  background-color: #d4af37;
  color: #0a0a0a;
}

.dark-theme :deep(.status-tag.success) {
  background-color: #67c23a;
  color: #0a0a0a;
}

.dark-theme :deep(.status-tag.failed) {
  background-color: #f56c6c;
  color: #ffffff;
}

/* 暗色主题下的警告提示 */
.dark-theme :deep(.el-alert) {
  background-color: #1a1a1a;
  border: 1px solid #2a2a2a;
  color: #d0d0d0;
}

.dark-theme :deep(.el-alert__title) {
  color: #d0d0d0;
}

.dark-theme :deep(.el-alert__description) {
  color: #a0a0a0;
}

.dark-theme :deep(.el-alert--warning) {
  background-color: #2a251a;
  border-color: #d4af37;
}

.dark-theme :deep(.el-alert--info) {
  background-color: #1a1a2a;
  border-color: #409eff;
}
</style>