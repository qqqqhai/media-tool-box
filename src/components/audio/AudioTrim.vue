<template>
  <div class="audio-trim-page">
    <!-- 参数配置区域 -->
    <el-card class="config-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>裁剪参数配置</span>
        </div>
      </template>
      
      <div class="config-form">
        <el-form :model="config" label-width="120px" inline>
          <!-- 裁剪开始时间 -->
          <el-form-item label="开始时间">
            <el-time-picker
              v-model="config.startTime"
              format="HH:mm:ss"
              value-format="HH:mm:ss"
              :default-value="new Date(0, 0, 0, 0, 0, 0)"
              style="width: 180px"
            />
          </el-form-item>
          <!-- 裁剪结束时间 -->
          <el-form-item label="结束时间">
            <el-time-picker
              v-model="config.endTime"
              format="HH:mm:ss"
              value-format="HH:mm:ss"
              :default-value="new Date(0, 0, 0, 0, 0, 30)"
              style="width: 180px"
            />
          </el-form-item>
          <!-- 输出格式 -->
          <el-form-item label="输出格式">
            <el-select v-model="config.outputFormat" style="width: 180px">
              <el-option label="保持原格式" value="origin" />
              <el-option label="MP3" value="mp3" />
              <el-option label="WAV" value="wav" />
              <el-option label="M4A" value="m4a" />
            </el-select>
          </el-form-item>
        </el-form>
        <el-alert type="info" description="提示：裁剪时间请根据音频实际时长填写，超出时长会导致裁剪失败" show-icon style="margin-top: 10px;" />
      </div>
    </el-card>

    <!-- 文件上传与列表区域 -->
    <el-card class="file-card" shadow="never" style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <span>音频文件列表</span>
          <div>
            <el-button 
              type="primary" 
              :disabled="fileList.length === 0 || isProcessing"
              @click="handleStartTrim"
              :loading="isProcessing"
            >
              开始批量裁剪
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
        validateMode="audio"
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

// 响应式状态
const fileUploadRef = ref(null)
const fileList = ref([])
const isProcessing = ref(false)
// 裁剪参数配置
const config = ref({
  startTime: '00:00:00', // 默认从开头开始
  endTime: '00:00:30', // 默认裁剪前30秒
  outputFormat: 'origin' // 默认保持原格式
})

/**
 * 监听文件列表变化
 */
const handleFileListChange = (files) => {
  fileList.value = files
}

/**
 * 开始批量裁剪
 */
const handleStartTrim = async () => {
  if (fileList.value.length === 0) {
    ElMessage.warning('请先选择要裁剪的音频文件')
    return
  }
  // 简单校验时间
  if (config.value.startTime >= config.value.endTime) {
    ElMessage.error('结束时间必须大于开始时间')
    return
  }
  if (isProcessing.value) return

  isProcessing.value = true
  let successCount = 0
  const failList = []

  try {
    ElMessage.info('正在初始化ffmpeg核心...')
    await ffmpegWorker.init()

    // 循环处理每个文件
    for (let i = 0; i < fileList.value.length; i++) {
      const fileItem = fileList.value[i]
      const file = fileItem.file
      const originExt = getFileExt(file)
      
      fileUploadRef.value.updateFileStatus(i, 'processing', { progress: 0 })

      try {
        const inputFileName = `audio_trim_input_${i}_${file.name}`
        // 确定输出格式和文件名
        const outputExt = config.value.outputFormat === 'origin' ? originExt : config.value.outputFormat
        const outputFileName = `trimmed_${file.name.replace(/\.[^.]+$/, `.${outputExt}`)}`
        
        // 核心：ffmpeg裁剪命令
        // -ss 开始时间，-to 结束时间，-c:a copy 无损复制音频流，速度快
        const command = [
          '-ss', config.value.startTime,
          '-to', config.value.endTime,
          '-i', inputFileName,
          '-c:a', 'copy', // 无损裁剪，速度极快，如果需要转格式可以去掉这个，自动重新编码
          '-y',
          outputFileName
        ]

        // 如果需要转格式，就去掉copy，让ffmpeg自动重新编码
        if (config.value.outputFormat !== 'origin') {
          command.splice(4, 1) // 删掉'-c:a'
          command.splice(4, 1) // 删掉'copy'
        }

        // 执行命令
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
        const mimeType = AUDIO_SUPPORT_CONFIG.mimeTypeMap[outputExt] || 'audio/mpeg'
        const resultBlob = new Blob([fileData], { type: mimeType })
        const resultUrl = URL.createObjectURL(resultBlob)

        fileUploadRef.value.updateFileStatus(i, 'success', {
          resultFile: { blob: resultBlob, url: resultUrl, fileName },
          resultSize: formatFileSize(resultBlob.size)
        })
        successCount++

      } catch (err) {
        console.error(`文件${fileItem.fileName}裁剪失败：`, err)
        fileUploadRef.value.updateFileStatus(i, 'failed', { errorMsg: err.message })
        failList.push({ fileName: fileItem.fileName, error: err.message })
      }
    }

    if (failList.length === 0) {
      ElMessage.success(`全部裁剪完成！成功处理${successCount}个文件`)
    } else {
      ElMessage.warning(`处理完成，成功${successCount}个，失败${failList.length}个`)
    }

  } catch (err) {
    console.error('批量裁剪失败：', err)
    ElMessage.error(`裁剪失败：${err.message || '未知错误'}`)
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
  fileUploadRef.value?.handleClearAll()
}

// 组件销毁时释放内存
onUnmounted(() => {
  ffmpegWorker.destroy()
})
</script>

<style scoped>
.audio-trim-page {
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