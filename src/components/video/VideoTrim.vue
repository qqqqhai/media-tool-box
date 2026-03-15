<template>
  <div class="video-trim-page">
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
              <el-option label="保持原格式（快速裁剪）" value="origin" />
              <el-option label="MP4" value="mp4" />
            </el-select>
          </el-form-item>
        </el-form>
        <el-alert type="info" description="提示：1. 时间请根据视频实际时长填写，超出时长会导致裁剪失败；2. 保持原格式会用无损复制模式，裁剪速度极快" show-icon style="margin-top: 10px;" />
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
import { getFileExt, formatFileSize, VIDEO_SUPPORT_CONFIG } from '../../utils/fileUtils'

// 响应式状态
const fileUploadRef = ref(null)
const fileList = ref([])
const isProcessing = ref(false)
// 裁剪参数配置
const config = ref({
  startTime: '00:00:00', // 默认从开头开始
  endTime: '00:00:30', // 默认裁剪前30秒
  outputFormat: 'origin' // 默认保持原格式，快速裁剪
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
    ElMessage.warning('请先选择要裁剪的视频文件')
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

    // 串行处理
    for (let i = 0; i < fileList.value.length; i++) {
      const fileItem = fileList.value[i]
      const file = fileItem.file
      const originExt = getFileExt(file)
      
      fileUploadRef.value.updateFileStatus(i, 'processing', { progress: 0 })

      try {
        const inputFileName = `video_trim_input_${i}_${file.name}`
        // 确定输出格式和文件名
        const outputExt = config.value.outputFormat === 'origin' ? originExt : 'mp4'
        const outputFileName = `trimmed_${file.name.replace(/\.[^.]+$/, `.${outputExt}`)}`
        
        // 核心：裁剪命令
        // 【关键】-ss 放在 -i 前面，是关键帧快速定位，裁剪速度极快
        let command
        if (config.value.outputFormat === 'origin') {
          // 保持原格式，直接流拷贝，避免重新编码，速度更快也更省内存
          command = [
            '-ss', config.value.startTime, // 开始时间
            '-to', config.value.endTime,   // 结束时间
            '-i', inputFileName,           // 输入文件
            '-c', 'copy',
            '-avoid_negative_ts', 'make_zero',
            '-y',
            outputFileName
          ]
        } else {
          // 转成 MP4，使用 H.264 + AAC 编码，兼容性最好
          command = [
            '-ss', config.value.startTime, // 开始时间
            '-to', config.value.endTime,   // 结束时间
            '-i', inputFileName,           // 输入文件
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-y',
            outputFileName
          ]
        }

        // 执行裁剪命令
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
        const mimeType = VIDEO_SUPPORT_CONFIG.mimeTypeMap[outputExt] || 'video/mp4'
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

    // 结果提示
    if (failList.length === 0) {
      ElMessage.success(`全部裁剪完成！成功处理${successCount}个视频文件`)
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
.video-trim-page {
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