<template>
  <div class="image-compress-page">
    <!-- 参数配置区域 -->
    <el-card class="config-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>压缩参数配置</span>
        </div>
      </template>
      
      <div class="config-form">
        <el-form :model="config" label-width="120px" inline>
          <!-- 压缩质量配置 -->
          <el-form-item label="压缩质量">
            <el-slider
              v-model="config.quality"
              :min="1"
              :max="100"
              :step="1"
              show-input
              style="width: 300px;"
            />
            <div class="form-tip">质量越低，文件体积越小，建议值：70-90</div>
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
              @click="handleStartCompress"
              :loading="isProcessing"
            >
              开始批量压缩
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
import FileUploadList from '../FileUploadList.vue'
import { ffmpegWorker } from '../../utils/workerManager'
import { getFileExt, IMAGE_SUPPORT_CONFIG, formatFileSize, revokeObjectURLs } from '../../utils/fileUtils'

// 响应式状态
const fileUploadRef = ref(null)
const fileList = ref([])
const isProcessing = ref(false)
// 压缩参数配置
const config = ref({
  quality: 80 // 默认压缩质量80
})

/**
 * 监听文件列表变化
 */
const handleFileListChange = (files) => {
  fileList.value = files
}

/**
 * 开始批量压缩
 */
const handleStartCompress = async () => {
  if (fileList.value.length === 0) {
    ElMessage.warning('请先选择要压缩的图片文件')
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
      const fileExt = getFileExt(file)
      
      // 更新状态为处理中
      fileUploadRef.value.updateFileStatus(i, 'processing', { progress: 0 })

      try {
        const inputFileName = `input_${i}_${file.name}`
        const outputFileName = `compressed_${file.name}`
        const quality = config.value.quality
        let command = []

        // 根据不同的图片格式，生成对应的压缩命令
        if (fileExt === 'jpg' || fileExt === 'jpeg') {
          const qvValue = Math.max(2, Math.min(31, 31 - Math.round(quality / 100 * 29)))
          command = ['-i', inputFileName, '-q:v', String(qvValue), outputFileName]
        } else if (fileExt === 'png') {
          // PNG压缩，用质量参数+压缩级别
          command = ['-i', inputFileName, '-compression_level', '6', '-quality', String(quality), outputFileName]
        } else if (fileExt === 'webp') {
          command = ['-i', inputFileName, '-q:v', String(quality), outputFileName]
        } else if (fileExt === 'avif') {
          const crfValue = Math.max(0, Math.min(63, 63 - Math.round(quality / 100 * 63)))
          command = ['-i', inputFileName, '-crf', String(crfValue), outputFileName]
        } else {
          // 其他格式通用压缩
          command = ['-i', inputFileName, '-q:v', String(quality), outputFileName]
        }

        // 执行压缩命令
        const result = await ffmpegWorker.execCommand({
          file,
          inputFileName,
          outputFileName,
          command,
          onProgress: (progress) => {
            fileUploadRef.value.updateFileStatus(i, 'processing', { progress })
          }
        })

        // 处理结果
        const { fileData, fileName } = result
        const mimeType = IMAGE_SUPPORT_CONFIG.mimeTypeMap[fileExt] || 'image/octet-stream'
        const resultBlob = new Blob([fileData], { type: mimeType })
        const resultUrl = URL.createObjectURL(resultBlob)

        // 更新状态
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
        console.error(`文件${fileItem.fileName}压缩失败：`, err)
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
      ElMessage.success(`全部压缩完成！成功处理${successCount}个文件`)
    } else {
      ElMessage.warning(`处理完成，成功${successCount}个，失败${failList.length}个`)
    }

  } catch (err) {
    console.error('批量压缩失败：', err)
    ElMessage.error(`压缩失败：${err.message || '未知错误'}`)
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
.image-compress-page {
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
.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>