<template>
  <div class="file-upload-list">
    <!-- 文件上传区域 -->
    <el-upload
      class="upload-area"
      action="#"
      :auto-upload="false"
      :show-file-list="false"
      :on-change="handleFileChange"
      :accept="accept"
      multiple
      drag
    >
      <el-icon class="upload-icon"><Upload /></el-icon>
      <div class="upload-text">拖拽文件到此处，或点击选择文件</div>
      <div class="upload-tip">支持{{ acceptTip }}格式，可批量选择多个文件</div>
    </el-upload>

    <!-- 错误提示（格式不支持的文件） -->
    <el-alert
      v-if="errorList.length > 0"
      title="有部分文件格式不支持，已自动过滤"
      type="warning"
      style="margin: 15px 0;"
      show-icon
      closable
    >
      <template #default>
        <ul>
          <li v-for="(item, index) in errorList" :key="index">
            {{ item.fileName }}：{{ item.message }}
          </li>
        </ul>
      </template>
    </el-alert>

    <!-- 已上传的文件列表 -->
    <div v-if="fileList.length > 0" class="file-list-container">
      <div class="list-header">
        <span>已选择 {{ fileList.length }} 个文件</span>
        <el-button type="danger" text @click="handleClearAll">清空全部</el-button>
      </div>

      <!-- 文件列表网格 -->
      <div class="file-grid">
        <div v-for="(item, index) in fileList" :key="index" class="file-card">
          <!-- 缩略图预览 -->
          <div class="file-thumbnail">
            <!-- 图片文件：显示缩略图 -->
              <img v-if="isImageFile(item.file)" :src="item.previewUrl" :alt="item.file.name" />
              <!-- 音频文件：显示音频图标+播放控件 -->
              <div v-else-if="isAudioFile(item.file)" class="media-placeholder">
                <el-icon class="media-icon"><Headset /></el-icon>
                <audio :src="item.previewUrl" controls style="width: 90%; margin-top: 8px;" />
              </div>
              <!-- 视频文件：显示视频缩略图+播放控件 -->
              <div v-else-if="isVideoFile(item.file)" class="media-placeholder">
                <el-icon class="media-icon"><VideoCamera /></el-icon>
                <video :src="item.previewUrl" controls style="width: 90%; margin-top: 8px; max-height: 80px;" />
              </div>
              <!-- 其他文件：显示通用图标 -->
              <div v-else class="media-placeholder">
                <el-icon class="media-icon"><Paperclip /></el-icon>
              </div>
              <!-- 处理状态标签（原有代码不变） -->
              <div v-if="item.status" class="status-tag" :class="item.status">
                {{ statusTextMap[item.status] }}
              </div>
              <!-- 处理进度条（原有代码不变） -->
              <el-progress
                v-if="item.status === 'processing' && item.progress >= 0"
                :percentage="item.progress"
                :show-text="false"
                stroke-width="4"
                class="progress-bar"
              />
          </div>
          <!-- 文件信息 -->
          <div class="file-info">
            <p class="file-name" :title="item.file.name">{{ item.file.name }}</p>
            <p class="file-size">原大小：{{ item.formattedSize }}</p>
            <p v-if="item.resultSize" class="result-size">处理后：{{ item.resultSize }}</p>
          </div>
          <!-- 操作按钮 -->
          <div class="file-actions">
            <!-- 下载按钮，处理完成后显示 -->
            <el-button
              v-if="item.status === 'success'"
              type="primary"
              link
              @click="handleDownload(item)"
            >
              下载
            </el-button>
            <!-- 删除按钮 -->
            <el-button type="danger" link @click="handleRemove(index)">移除</el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { Upload, Headset, VideoCamera, Paperclip } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
// 导入我们封装的文件工具函数
import { batchValidateImageFiles, batchValidateAudioFiles, batchValidateVideoFiles, formatFileSize, downloadFile, revokeObjectURLs, getFileExt } from '../utils/fileUtils'
import { AUDIO_SUPPORT_CONFIG, VIDEO_SUPPORT_CONFIG } from '../utils/fileUtils'
// 接收父组件传过来的参数
const props = defineProps({
  // 支持的文件格式，默认是所有图片格式
  accept: {
    type: String,
    default: '.jpg,.jpeg,.png,.webp,.avif,.bmp'
  },
  // 格式提示文案
  acceptTip: {
    type: String,
    default: 'JPG、PNG、WebP、AVIF'
  },
  // 文件类型验证模式：'image' | 'audio' | 'video' | 'all'
  validateMode: {
    type: String,
    default: 'image'
  }
})

// 给父组件暴露的事件和方法
const emit = defineEmits(['fileChange'])

// 响应式状态
const fileList = ref([]) // 有效文件列表
const errorList = ref([]) // 格式错误的文件列表
// 处理状态文本映射
const statusTextMap = {
  pending: '待处理',
  processing: '处理中',
  success: '处理完成',
  failed: '处理失败'
}

//处理用户选择的文件
// 判断是否为图片文件
const isImageFile = (file) => {
  const ext = getFileExt(file)
  return ['jpg', 'jpeg', 'png', 'webp', 'avif', 'bmp', 'gif'].includes(ext)
}

// 判断是否为音频文件
const isAudioFile = (file) => {
  const ext = getFileExt(file)
  return AUDIO_SUPPORT_CONFIG.inputExts.includes(ext)
}

// 判断是否为视频文件
const isVideoFile = (file) => {
  const ext = getFileExt(file)
  return VIDEO_SUPPORT_CONFIG.inputExts.includes(ext)
}

 
const handleFileChange = (uploadFile) => {
  // 获取用户选择的所有文件
  const rawFiles = uploadFile.raw ? [uploadFile.raw] : uploadFile.map(item => item.raw)
  if (!rawFiles || rawFiles.length === 0) return

  // 根据验证模式选择不同的验证函数
  let validationResult
  switch (props.validateMode) {
    case 'audio':
      validationResult = batchValidateAudioFiles(rawFiles)
      break
    case 'video':
      validationResult = batchValidateVideoFiles(rawFiles)
      break
    case 'all':
      // 对于'all'模式，我们接受所有文件类型
      validationResult = {
        validFiles: rawFiles,
        errorList: []
      }
      break
    default: // 'image'
      validationResult = batchValidateImageFiles(rawFiles)
  }

  const { validFiles, errorList: errors } = validationResult
  errorList.value = errors

  if (validFiles.length === 0) {
    let message = '没有选择有效的文件'
    switch (props.validateMode) {
      case 'audio':
        message = '没有选择有效的音频文件'
        break
      case 'video':
        message = '没有选择有效的视频文件'
        break
      case 'image':
        message = '没有选择有效的图片文件'
        break
    }
    ElMessage.warning(message)
    return
  }

  // 把有效文件转换成列表需要的格式
  const newFileItems = validFiles.map(file => {
    // 生成预览用的ObjectURL
    const previewUrl = URL.createObjectURL(file)
    return {
      file, // 原始文件对象
      fileName: file.name,
      formattedSize: formatFileSize(file.size),
      previewUrl, // 预览地址
      status: 'pending', // 处理状态：待处理
      progress: 0, // 处理进度
      resultFile: null, // 处理后的文件对象
      resultSize: '', // 处理后的文件大小
      errorMsg: '' // 处理失败的错误信息
    }
  })

  // 把新文件添加到列表里（去重，避免重复添加同一个文件）
  const existingFileNames = new Set(fileList.value.map(item => item.fileName))
  const uniqueNewFiles = newFileItems.filter(item => !existingFileNames.has(item.fileName))
  
  if (uniqueNewFiles.length > 0) {
    fileList.value = [...fileList.value, ...uniqueNewFiles]
    // 通知父组件，文件列表变化了
    emit('fileChange', fileList.value)
  }

  if (uniqueNewFiles.length < validFiles.length) {
    ElMessage.info('已跳过重复的文件')
  }
}

/**
 * 移除单个文件
 */
const handleRemove = (index) => {
  const item = fileList.value[index]
  // 释放预览URL的内存，避免内存泄漏
  revokeObjectURLs(item.previewUrl)
  if (item.resultFile?.url) {
    revokeObjectURLs(item.resultFile.url)
  }
  // 从列表里删除
  fileList.value.splice(index, 1)
  // 通知父组件
  emit('fileChange', fileList.value)
}

/**
 * 清空所有文件
 */
const handleClearAll = () => {
  // 先释放所有内存
  fileList.value.forEach(item => {
    revokeObjectURLs(item.previewUrl)
    if (item.resultFile?.url) {
      revokeObjectURLs(item.resultFile.url)
    }
  })
  fileList.value = []
  errorList.value = []
  // 通知父组件
  emit('fileChange', [])
}

/**
 * 下载单个处理完成的文件
 */
const handleDownload = (item) => {
  if (!item.resultFile) return
  downloadFile(item.resultFile.blob, item.resultFile.fileName)
}

// 给父组件暴露的方法，父组件可以直接调用
defineExpose({
  // 获取文件列表
  getFileList: () => fileList.value,
  // 更新单个文件的处理状态
  updateFileStatus: (index, status, data = {}) => {
    if (fileList.value[index]) {
      fileList.value[index] = { ...fileList.value[index], status, ...data }
    }
  },
  // 批量重置所有文件的状态（重新处理时用）
  resetAllStatus: () => {
    fileList.value.forEach(item => {
      item.status = 'pending'
      item.progress = 0
      item.resultFile = null
      item.resultSize = ''
      item.errorMsg = ''
    })
  }
})

// 组件销毁时，释放所有内存，避免内存泄漏
onUnmounted(() => {
  fileList.value.forEach(item => {
    revokeObjectURLs(item.previewUrl)
    if (item.resultFile?.url) {
      revokeObjectURLs(item.resultFile.url)
    }
  })
})
</script>

<style scoped>
.file-upload-list {
  width: 100%;
}
/* 上传区域样式 */
.upload-area {
  width: 100%;
}
.upload-area :deep(.el-upload-dragger) {
  width: 100%;
  height: 180px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.upload-icon {
  font-size: 48px;
  color: #409eff;
  margin-bottom: 16px;
}
.upload-text {
  font-size: 16px;
  color: #303133;
  margin-bottom: 8px;
}
.upload-tip {
  font-size: 14px;
  color: #909399;
}
/* 列表头部 */
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 20px 0 15px;
  font-size: 14px;
  color: #606266;
}
/* 文件网格布局 */
.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
/* 文件卡片样式 */
.file-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  background-color: #fff;
  transition: box-shadow 0.2s;
}
.file-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}
/* 缩略图区域 */
.file-thumbnail {
  position: relative;
  width: 100%;
  height: 140px;
  background-color: #f5f7fa;
  overflow: hidden;
}
.file-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.status-tag {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #fff;
  z-index: 10;
}
.status-tag.pending {
  background-color: #909399;
}
.status-tag.processing {
  background-color: #e6a23c;
}
.status-tag.success {
  background-color: #67c23a;
}
.status-tag.failed {
  background-color: #f56c6c;
}
.progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
}
/* 文件信息 */
.file-info {
  padding: 10px 12px;
}
.file-name {
  font-size: 14px;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0 0 4px;
}
.file-size, .result-size {
  font-size: 12px;
  color: #909399;
  margin: 2px 0;
}
.result-size {
  color: #67c23a;
}
/* 操作按钮 */
.file-actions {
  padding: 0 12px 10px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
/* 音视频文件占位样式 */
.media-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: #f5f7fa;
  color: #909399;
}
.media-icon {
  font-size: 36px;
  margin-top: 10px;
}
</style>