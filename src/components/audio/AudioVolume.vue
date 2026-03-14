<template>
  <div class="audio-volume-page">
    <el-card class="config-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>音量调整配置</span>
        </div>
      </template>
      
      <div class="config-form">
        <el-form :model="config" label-width="120px" inline>
          <el-form-item label="音量倍数">
            <el-slider
              v-model="config.volume"
              :min="0.1"
              :max="5"
              :step="0.1"
              show-input
              style="width: 300px;"
            />
            <span style="margin-left: 8px;">倍</span>
          </el-form-item>
        </el-form>
        <el-alert type="warning" description="提示：音量倍数过大可能会导致音频破音，建议控制在0.5-2倍之间" show-icon style="margin-top: 10px;" />
      </div>
    </el-card>

    <el-card class="file-card" shadow="never" style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <span>音频文件列表</span>
          <div>
            <el-button 
              type="primary" 
              :disabled="fileList.length === 0 || isProcessing"
              @click="handleStartAdjust"
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

      <FileUploadList
        ref="fileUploadRef"
        accept=".mp3,.wav,.flac,.aac,.ogg,.m4a"
        acceptTip="MP3、WAV、FLAC、AAC、OGG、M4A"
        @fileChange="handleFileListChange"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import FileUploadList from '../FileUploadList.vue'
import { ffmpegWorker } from '../../utils/workerManager'
import { getFileExt, formatFileSize, AUDIO_SUPPORT_CONFIG } from '../../utils/fileUtils'

const fileUploadRef = ref(null)
const fileList = ref([])
const isProcessing = ref(false)
const config = ref({
  volume: 1.0 // 默认1倍音量，不改变
})

const handleFileListChange = (files) => {
  fileList.value = files
}

const handleStartAdjust = async () => {
  if (fileList.value.length === 0) {
    ElMessage.warning('请先选择要调整的音频文件')
    return
  }
  if (isProcessing.value) return

  isProcessing.value = true
  let successCount = 0
  const failList = []

  try {
    ElMessage.info('正在初始化ffmpeg核心...')
    await ffmpegWorker.init()

    for (let i = 0; i < fileList.value.length; i++) {
      const fileItem = fileList.value[i]
      const file = fileItem.file
      const originExt = getFileExt(file)
      
      fileUploadRef.value.updateFileStatus(i, 'processing', { progress: 0 })

      try {
        const inputFileName = `audio_volume_input_${i}_${file.name}`
        const outputFileName = `volume_${file.name}`
        const outputExt = originExt
        
        // 核心：音量调整命令，volume滤镜
        const command = [
          '-i', inputFileName,
          '-filter:a', `volume=${config.value.volume}`, // 音量滤镜
          '-y',
          outputFileName
        ]

        const result = await ffmpegWorker.execCommand({
          file,
          inputFileName,
          outputFileName,
          command,
          onProgress: (progress) => {
            fileUploadRef.value.updateFileStatus(i, 'processing', { progress })
          }
        })

        const { fileData, fileName } = result
        const mimeType = AUDIO_SUPPORT_CONFIG.mimeTypeMap[outputExt] || 'audio/mpeg'
        const resultBlob = new Blob([fileData], { type: mimeType })
        const resultUrl = URL.createObjectURL(resultBlob)

        fileUploadRef.value.updateFileStatus(i, 'success', {
          resultFile: { blob: resultBlob, url: resultUrl, fileName },
          resultSize: formatFileSize(resultBlob.size)
        })
        successCount++

      } catch (err) {
        console.error(`文件${fileItem.fileName}调整失败：`, err)
        fileUploadRef.value.updateFileStatus(i, 'failed', { errorMsg: err.message })
        failList.push({ fileName: fileItem.fileName, error: err.message })
      }
    }

    if (failList.length === 0) {
      ElMessage.success(`全部调整完成！成功处理${successCount}个文件`)
    } else {
      ElMessage.warning(`处理完成，成功${successCount}个，失败${failList.length}个`)
    }

  } catch (err) {
    console.error('批量调整失败：', err)
    ElMessage.error(`调整失败：${err.message || '未知错误'}`)
  } finally {
    isProcessing.value = false
  }
}

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
  fileUploadRef.value?.handleClearAll()
}

onUnmounted(() => {
  ffmpegWorker.destroy()
})
</script>

<style scoped>
.audio-volume-page {
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