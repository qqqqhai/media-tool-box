<template>
  <div class="video-extract-page">
    <!-- 参数配置区域 -->
    <el-card class="config-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>提取功能配置</span>
        </div>
      </template>
      
      <div class="config-form">
        <el-form :model="config" label-width="120px" inline>
          <!-- 提取类型 -->
          <el-form-item label="提取类型">
            <el-radio-group v-model="config.extractType">
              <el-radio label="cover">提取视频封面</el-radio>
              <el-radio label="audio">提取音频文件</el-radio>
            </el-radio-group>
          </el-form-item>

          <!-- 提取封面的配置 -->
          <template v-if="config.extractType === 'cover'">
            <el-form-item label="封面时间点">
              <el-time-picker
                v-model="config.coverTime"
                format="HH:mm:ss"
                value-format="HH:mm:ss"
                :default-value="new Date(0, 0, 0, 0, 0, 1)"
                style="width: 180px"
              />
              <div class="form-tip">默认取第1秒的画面，避免黑屏</div>
            </el-form-item>
            <el-form-item label="封面格式">
              <el-select v-model="config.coverFormat" style="width: 150px">
                <el-option label="JPG" value="jpg" />
                <el-option label="PNG" value="png" />
                <el-option label="WebP" value="webp" />
              </el-select>
            </el-form-item>
          </template>

          <!-- 提取音频的配置 -->
          <template v-if="config.extractType === 'audio'">
            <el-form-item label="音频格式">
              <el-select v-model="config.audioFormat" style="width: 150px">
                <el-option label="MP3" value="mp3" />
                <el-option label="WAV" value="wav" />
                <el-option label="M4A" value="m4a" />
              </el-select>
            </el-form-item>
            <el-form-item label="音频码率">
              <el-select v-model="config.audioBitrate" style="width: 150px">
                <el-option label="高音质 192k" value="192k" />
                <el-option label="标准 128k" value="128k" />
              </el-select>
            </el-form-item>
          </template>
        </el-form>
      </div>
    </el-card>

    <!-- 文件上传与列表区域 -->
    <el-card class="file-card" shadow="never" style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <span>视频文件列表</span>
          <div>
            <el-button 
              type="primary" 
              :disabled="fileList.length === 0 || isProcessing"
              @click="handleStartExtract"
              :loading="isProcessing"
            >
              开始批量提取
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
        accept=".mp4,.mov,.avi,.mkv,.flv,.webm"
        acceptTip="MP4、MOV、AVI、MKV、FLV、WEBM"
        validateMode="video"
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
import { getFileExt, formatFileSize, AUDIO_SUPPORT_CONFIG, IMAGE_SUPPORT_CONFIG } from '../../utils/fileUtils'

// 响应式状态
const fileUploadRef = ref(null)
const fileList = ref([])
const isProcessing = ref(false)
// 提取参数配置
const config = ref({
  extractType: 'cover', // 默认提取封面
  coverTime: '00:00:01', // 默认取第1秒的画面
  coverFormat: 'jpg', // 封面默认JPG
  audioFormat: 'mp3', // 音频默认MP3
  audioBitrate: '128k' // 默认标准音质
})

/**
 * 监听文件列表变化
 */
const handleFileListChange = (files) => {
  fileList.value = files
}

/**
 * 开始批量提取
 */
const handleStartExtract = async () => {
  if (fileList.value.length === 0) {
    ElMessage.warning('请先选择视频文件')
    return
  }
  if (isProcessing.value) return

  isProcessing.value = true
  let successCount = 0
  const failList = []
  const isExtractCover = config.value.extractType === 'cover'

  try {
    ElMessage.info('正在初始化ffmpeg核心...')
    await ffmpegWorker.init()

    // 串行处理
    for (let i = 0; i < fileList.value.length; i++) {
      const fileItem = fileList.value[i]
      const file = fileItem.file
      
      fileUploadRef.value.updateFileStatus(i, 'processing', { progress: 0 })

      try {
        const inputFileName = `video_extract_input_${i}_${file.name}`
        let outputFileName = ''
        let command = []
        let mimeType = ''

        // 提取封面逻辑
        if (isExtractCover) {
          const coverFormat = config.value.coverFormat
          outputFileName = `cover_${file.name.replace(/\.[^.]+$/, `.${coverFormat}`)}`
          mimeType = IMAGE_SUPPORT_CONFIG.mimeTypeMap[coverFormat]
          
          // 提取封面核心命令：-ss 时间点，-vframes 1 只取1帧
          command = [
            '-ss', config.value.coverTime,
            '-i', inputFileName,
            '-vframes', '1', // 只提取1帧
            '-q:v', '2', // 最高画质
            '-y',
            outputFileName
          ]
        } 
        // 提取音频逻辑
        else {
          const audioFormat = config.value.audioFormat
          outputFileName = `audio_${file.name.replace(/\.[^.]+$/, `.${audioFormat}`)}`
          mimeType = AUDIO_SUPPORT_CONFIG.mimeTypeMap[audioFormat]
          
          // 提取音频核心命令：-vn 丢弃视频流，只保留音频
          command = [
            '-i', inputFileName,
            '-vn', // 禁用视频流
            '-b:a', config.value.audioBitrate,
            '-y',
            outputFileName
          ]
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
        const resultBlob = new Blob([fileData], { type: mimeType })
        const resultUrl = URL.createObjectURL(resultBlob)

        fileUploadRef.value.updateFileStatus(i, 'success', {
          resultFile: { blob: resultBlob, url: resultUrl, fileName },
          resultSize: formatFileSize(resultBlob.size)
        })
        successCount++

      } catch (err) {
        console.error(`文件${fileItem.fileName}提取失败：`, err)
        fileUploadRef.value.updateFileStatus(i, 'failed', { errorMsg: err.message })
        failList.push({ fileName: fileItem.fileName, error: err.message })
      }
    }

    // 结果提示
    const typeText = isExtractCover ? '封面' : '音频'
    if (failList.length === 0) {
      ElMessage.success(`全部提取完成！成功提取${successCount}个视频的${typeText}`)
    } else {
      ElMessage.warning(`处理完成，成功${successCount}个，失败${failList.length}个`)
    }

  } catch (err) {
    console.error('批量提取失败：', err)
    ElMessage.error(`提取失败：${err.message || '未知错误'}`)
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
.video-extract-page {
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