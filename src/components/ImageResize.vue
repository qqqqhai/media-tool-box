<template>
  <div class="image-resize-page">
    <!-- 参数配置区域 -->
    <el-card class="config-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>尺寸调整配置</span>
        </div>
      </template>
      
      <div class="config-form">
        <el-form :model="config" label-width="120px" inline>
          <!-- 调整模式选择 -->
          <el-form-item label="调整模式">
            <el-radio-group v-model="config.mode">
              <el-radio label="scale">等比缩放</el-radio>
              <el-radio label="fixed">固定尺寸</el-radio>
              <el-radio label="max">限制最大宽高</el-radio>
            </el-radio-group>
          </el-form-item>

          <!-- 等比缩放模式的参数 -->
          <template v-if="config.mode === 'scale'">
            <el-form-item label="缩放比例">
              <el-slider
                v-model="config.scale"
                :min="1"
                :max="200"
                :step="1"
                show-input
                style="width: 200px;"
              />
              <span style="margin-left: 8px;">%</span>
            </el-form-item>
          </template>

          <!-- 固定尺寸模式的参数 -->
          <template v-if="config.mode === 'fixed'">
            <el-form-item label="宽度">
              <el-input-number v-model="config.width" :min="1" :max="10000" style="width: 120px;" />
              <span style="margin: 0 8px;">px</span>
            </el-form-item>
            <el-form-item label="高度">
              <el-input-number v-model="config.height" :min="1" :max="10000" style="width: 120px;" />
              <span style="margin: 0 8px;">px</span>
            </el-form-item>
            <el-form-item label="保持比例">
              <el-switch v-model="config.keepRatio" />
            </el-form-item>
          </template>

          <!-- 限制最大宽高模式的参数 -->
          <template v-if="config.mode === 'max'">
            <el-form-item label="最大宽度">
              <el-input-number v-model="config.maxWidth" :min="1" :max="10000" style="width: 120px;" />
              <span style="margin: 0 8px;">px</span>
            </el-form-item>
            <el-form-item label="最大高度">
              <el-input-number v-model="config.maxHeight" :min="1" :max="10000" style="width: 120px;" />
              <span style="margin: 0 8px;">px</span>
            </el-form-item>
          </template>

          <!-- 输出格式 -->
          <el-form-item label="输出格式">
            <el-select v-model="config.outputFormat" style="width: 150px">
              <el-option label="保持原格式" value="origin" />
              <el-option label="JPG" value="jpg" />
              <el-option label="PNG" value="png" />
              <el-option label="WebP" value="webp" />
            </el-select>
          </el-form-item>
        </el-form>
      </div>
    </el-card>

    <!-- 文件上传与列表区域 -->
    <el-card class="file-card" shadow="never" style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <span>文件列表</span>
          <div>
            <el-button 
              type="primary" 
              :disabled="fileList.length === 0 || isProcessing"
              @click="handleStartResize"
              :loading="isProcessing"
            >
              开始批量调整
            </el-button>
            <el-button 
              :disabled="fileList.length === 0 || isProcessing"
              @click="handleReset"
            >
              重置
            </el-button>
          </div>
        </div>
      </template>

      <!-- 通用文件上传列表组件 -->
      <FileUploadList
        ref="fileUploadRef"
        @fileChange="handleFileListChange"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
// 导入封装的组件和工具
import FileUploadList from './FileUploadList.vue'
import { ffmpegWorker } from '../utils/workerManager'
import { getFileExt, IMAGE_SUPPORT_CONFIG, formatFileSize } from '../utils/fileUtils'

// 响应式状态
const fileUploadRef = ref(null)
const fileList = ref([])
const isProcessing = ref(false)
// 尺寸调整配置
const config = ref({
  mode: 'scale', // 调整模式：scale等比缩放 / fixed固定尺寸 / max限制最大宽高
  scale: 50, // 缩放比例，默认50%
  width: 800, // 固定宽度
  height: 600, // 固定高度
  keepRatio: true, // 固定尺寸时是否保持比例
  maxWidth: 1920, // 最大宽度
  maxHeight: 1080, // 最大高度
  outputFormat: 'origin' // 输出格式，origin=保持原格式
})

/**
 * 监听文件列表变化
 */
const handleFileListChange = (files) => {
  fileList.value = files
}

/**
 * 生成ffmpeg的尺寸调整命令
 * @returns {string[]} ffmpeg执行命令
 */
const buildResizeCommand = () => {
  const { mode, scale, width, height, keepRatio, maxWidth, maxHeight } = config.value
  let scaleParam = ''

  if (mode === 'scale') {
    // 等比缩放：scale=50%，就是宽高都乘以0.5
    const scaleRatio = (scale / 100).toFixed(2)
    scaleParam = `scale=iw*${scaleRatio}:ih*${scaleRatio}`
  } else if (mode === 'fixed') {
    // 固定尺寸
    if (keepRatio) {
      // 保持比例，按给定的宽高适配，不拉伸
      scaleParam = `scale=w=${width}:h=${height}:force_original_aspect_ratio=decrease`
    } else {
      // 强制拉伸到指定宽高
      scaleParam = `scale=${width}:${height}`
    }
  } else if (mode === 'max') {
    // 限制最大宽高，超出的等比缩小，不超出的保持原尺寸
    scaleParam = `scale=w='min(iw,${maxWidth})':h='min(ih,${maxHeight})':force_original_aspect_ratio=decrease`
  }

  return ['-vf', scaleParam]
}

/**
 * 开始批量调整尺寸
 */
const handleStartResize = async () => {
  if (fileList.value.length === 0) {
    ElMessage.warning('请先选择要调整的图片文件')
    return
  }
  if (isProcessing.value) return

  isProcessing.value = true
  let successCount = 0
  const failList = []

  try {
    // 初始化ffmpeg
    ElMessage.info('正在初始化ffmpeg核心...')
    await ffmpegWorker.init()

    // 串行处理每个文件
    for (let i = 0; i < fileList.value.length; i++) {
      const fileItem = fileList.value[i]
      const file = fileItem.file
      const originExt = getFileExt(file)
      
      // 更新状态为处理中
      fileUploadRef.value.updateFileStatus(i, 'processing', { progress: 0 })

      try {
        const inputFileName = `input_${i}_${file.name}`
        // 确定输出文件名和格式
        let outputExt = config.value.outputFormat === 'origin' ? originExt : config.value.outputFormat
        const outputFileName = `resized_${file.name.replace(/\.[^.]+$/, `.${outputExt}`)}`
        
        // 拼接完整的ffmpeg命令
        let command = ['-i', inputFileName]
        const resizeParams = buildResizeCommand()
        command = command.concat(resizeParams)
        command.push(outputFileName)

        // 调用Worker执行命令
        const result = await ffmpegWorker.execCommand({
          file,
          inputFileName,
          outputFileName,
          command,
          onProgress: (progress) => {
            fileUploadRef.value.updateFileStatus(i, 'processing', { progress })
          }
        })

        // 处理返回的结果
        const { fileData, fileName } = result
        const mimeType = IMAGE_SUPPORT_CONFIG.mimeTypeMap[outputExt] || 'image/octet-stream'
        const resultBlob = new Blob([fileData], { type: mimeType })
        const resultUrl = URL.createObjectURL(resultBlob)

        // 更新文件状态为成功
        fileUploadRef.value.updateFileStatus(i, 'success', {
          resultFile: {
            blob: resultBlob,
            url: resultUrl,
            fileName
          },
          resultSize: formatFileSize(resultBlob.size)
        })
        successCount++

      } catch (err) {
        console.error(`文件${fileItem.fileName}尺寸调整失败：`, err)
        fileUploadRef.value.updateFileStatus(i, 'failed', {
          errorMsg: err.message
        })
        failList.push({
          fileName: fileItem.fileName,
          error: err.message
        })
      }
    }

    // 结果提示
    if (failList.length === 0) {
      ElMessage.success(`全部调整完成！成功处理${successCount}个文件`)
    } else {
      ElMessage.warning(`处理完成，成功${successCount}个，失败${failList.length}个`)
    }

  } catch (err) {
    console.error('批量调整尺寸失败：', err)
    ElMessage.error(`处理失败：${err.message || '未知错误'}`)
  } finally {
    isProcessing.value = false
  }
}

/**
 * 重置功能
 */
const handleReset = async () => {
  if (isProcessing.value) {
    ElMessage.warning('正在处理中，无法重置')
    return
  }
  await ElMessageBox.confirm('确定要重置吗？会清空所有已选择的文件和处理结果', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
  fileList.value = []
  if (fileUploadRef.value) {
    fileUploadRef.value.handleClearAll()
  }
}

// 组件销毁时释放内存
onUnmounted(() => {
  ffmpegWorker.destroy()
})
</script>

<style scoped>
.image-resize-page {
  width: 100%;
}
.config-card, .file-card {
  width: 100%;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.config-form {
  padding: 10px 0;
}
</style>