<template>
  <div class="image-convert-page">
    <!-- 参数配置区域 -->
    <el-card class="config-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>转换参数配置</span>
        </div>
      </template>
      
      <div class="config-form">
        <el-form :model="config" label-width="120px" inline>
          <!-- 输出格式选择 -->
          <el-form-item label="目标输出格式">
            <el-select v-model="config.outputFormat" style="width: 180px">
              <el-option label="JPG" value="jpg" />
              <el-option label="PNG" value="png" />
              <el-option label="WebP" value="webp" />
              <el-option label="AVIF" value="avif" />
              <el-option label="BMP" value="bmp" />
            </el-select>
          </el-form-item>
          <!-- 输出质量配置 -->
          <el-form-item label="输出质量">
            <el-slider
              v-model="config.quality"
              :min="1"
              :max="100"
              :step="1"
              show-input
              style="width: 200px;"
            />
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
              @click="handleStartConvert"
              :loading="isProcessing"
            >
              开始批量转换
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
// 导入我们封装的组件和工具
import FileUploadList from './FileUploadList.vue'
import { ffmpegWorker } from '../utils/workerManager'
import { IMAGE_SUPPORT_CONFIG, formatFileSize, revokeObjectURLs } from '../utils/fileUtils'

// 响应式状态
const fileUploadRef = ref(null) // 文件上传组件的引用
const fileList = ref([]) // 待处理的文件列表
const isProcessing = ref(false) // 是否正在处理中
// 转换参数配置
const config = ref({
  outputFormat: 'webp', // 默认转WebP
  quality: 80 // 默认质量80
})

/**
 * 监听文件列表变化
 */
const handleFileListChange = (files) => {
  fileList.value = files
}

/**
 * 开始批量转换
 */
const handleStartConvert = async () => {
  if (fileList.value.length === 0) {
    ElMessage.warning('请先选择要转换的图片文件')
    return
  }
  if (isProcessing.value) return

  isProcessing.value = true
  let successCount = 0
  const failList = []

  try {
    // 先初始化Worker，确保ffmpeg加载完成
    ElMessage.info('正在初始化ffmpeg核心，首次加载可能需要几秒...')
    await ffmpegWorker.init()

    // 循环处理每个文件（新手先做串行处理，避免并行太多导致内存溢出，后续可优化成并发控制）
    for (let i = 0; i < fileList.value.length; i++) {
      const fileItem = fileList.value[i]
      const file = fileItem.file
      
      // 更新文件状态为处理中
      fileUploadRef.value.updateFileStatus(i, 'processing', { progress: 0 })

      try {
        // 1. 生成输入输出文件名
        const inputFileName = `input_${i}_${file.name}`
        // 把原文件的扩展名替换成目标格式
        const outputFileName = file.name.replace(/\.[^.]+$/, `.${config.value.outputFormat}`)
        
        // 2. 拼接ffmpeg转换命令
        // 不同格式的质量参数不一样，这里做兼容
        let command = []
        const outputFormat = config.value.outputFormat
        const quality = config.value.quality

        if (outputFormat === 'jpg' || outputFormat === 'jpeg') {
          // JPG质量参数：-q:v 2-31，数值越小质量越高，这里把0-100转成对应的值
          const qvValue = Math.max(2, Math.min(31, 31 - Math.round(quality / 100 * 29)))
          command = ['-i', inputFileName, '-q:v', String(qvValue), outputFileName]
        } else if (outputFormat === 'webp') {
          // WebP质量参数：-q:v 0-100，数值越大质量越高
          command = ['-i', inputFileName, '-q:v', String(quality), outputFileName]
        } else if (outputFormat === 'avif') {
          // AVIF质量参数：-crf 0-63，数值越小质量越高
          const crfValue = Math.max(0, Math.min(63, 63 - Math.round(quality / 100 * 63)))
          command = ['-i', inputFileName, '-crf', String(crfValue), outputFileName]
        } else {
          // 其他格式直接转换
          command = ['-i', inputFileName, outputFileName]
        }

        // 3. 调用Worker执行命令
        const result = await ffmpegWorker.execCommand({
          file,
          inputFileName,
          outputFileName,
          command,
          // 监听单文件处理进度
          onProgress: (progress) => {
            fileUploadRef.value.updateFileStatus(i, 'processing', { progress })
          }
        })

        // 4. 处理返回的结果
        const { fileData, fileName } = result
        const mimeType = IMAGE_SUPPORT_CONFIG.mimeTypeMap[config.value.outputFormat] || 'image/octet-stream'
        const resultBlob = new Blob([fileData], { type: mimeType })
        const resultUrl = URL.createObjectURL(resultBlob)

        // 5. 更新文件状态为成功
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
        // 处理失败的情况
        console.error(`文件${fileItem.fileName}处理失败：`, err)
        fileUploadRef.value.updateFileStatus(i, 'failed', {
          errorMsg: err.message
        })
        failList.push({
          fileName: fileItem.fileName,
          error: err.message
        })
      }
    }

    // 全部处理完成后，给出结果提示
    if (failList.length === 0) {
      ElMessage.success(`全部转换完成！成功处理${successCount}个文件`)
    } else {
      ElMessage.warning(`处理完成，成功${successCount}个，失败${failList.length}个`)
    }

  } catch (err) {
    console.error('批量转换失败：', err)
    ElMessage.error(`转换失败：${err.message || '未知错误'}`)
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
  // 清空文件列表
  fileList.value = []
  // 调用子组件的清空方法
  if (fileUploadRef.value) {
    fileUploadRef.value.handleClearAll()
  }
}

// 组件销毁时，销毁Worker，释放内存
onUnmounted(() => {
  ffmpegWorker.destroy()
})
</script>

<style scoped>
.image-convert-page {
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