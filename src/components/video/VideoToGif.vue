<template>
  <div class="video-to-gif-page">
    <!-- 参数配置区域 -->
    <el-card class="config-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>转GIF参数配置</span>
        </div>
      </template>
      
      <div class="config-form">
        <el-form :model="config" label-width="120px" inline>
          <!-- 截取时间段 -->
          <el-form-item label="开始时间">
            <el-time-picker
              v-model="config.startTime"
              format="HH:mm:ss"
              value-format="HH:mm:ss"
              :default-value="new Date(0, 0, 0, 0, 0, 0)"
              style="width: 180px"
            />
          </el-form-item>
          <el-form-item label="截取时长">
            <el-input-number v-model="config.duration" :min="1" :max="60" style="width: 120px;" />
            <span style="margin-left: 4px;">秒</span>
          </el-form-item>
          <!-- 帧率配置 -->
          <el-form-item label="GIF帧率">
            <el-input-number v-model="config.fps" :min="1" :max="30" style="width: 120px;" />
            <span style="margin-left: 4px;">帧/秒</span>
          </el-form-item>
          <!-- 分辨率限制 -->
          <el-form-item label="最大宽度">
            <el-input-number v-model="config.maxWidth" :min="100" :max="1920" style="width: 120px;" />
            <span style="margin-left: 4px;">px</span>
          </el-form-item>
        </el-form>
        <el-alert type="warning" description="提示：1. GIF不适合太长的视频，建议截取5秒以内的片段，避免文件体积过大；2. 帧率建议10-15，平衡流畅度和体积" show-icon style="margin-top: 10px;" />
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
              @click="handleStartConvert"
              :loading="isProcessing"
            >
              开始批量转GIF
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
        accept=".mp4,.mov,.avi,.mkv,.webm"
        acceptTip="MP4、MOV、AVI、MKV、WEBM"
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
import { getFileExt, formatFileSize } from '../../utils/fileUtils'

// 响应式状态
const fileUploadRef = ref(null)
const fileList = ref([])
const isProcessing = ref(false)
// 转GIF参数配置
const config = ref({
  startTime: '00:00:00', // 默认从开头开始
  duration: 3, // 默认截取3秒
  fps: 10, // 默认10帧/秒
  maxWidth: 800 // 默认最大宽度800px，避免GIF太大
})

/**
 * 监听文件列表变化
 */
const handleFileListChange = (files) => {
  fileList.value = files
}

/**
 * 开始批量转GIF
 */
const handleStartConvert = async () => {
  if (fileList.value.length === 0) {
    ElMessage.warning('请先选择视频文件')
    return
  }
  if (config.value.duration <= 0) {
    ElMessage.error('截取时长必须大于0')
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
      
      fileUploadRef.value.updateFileStatus(i, 'processing', { progress: 0 })

      try {
        const inputFileName = `video_gif_input_${i}_${file.name}`
        const outputFileName = file.name.replace(/\.[^.]+$/, '.gif')
        
        // 【核心优化】转GIF的高质量命令，分两步：先生成调色板，再转GIF，解决画质糊的问题
        // 使用唯一的临时文件名，避免多个文件处理时的冲突
        const paletteFileName = `palette_${i}_${Date.now()}.png`
        
        // 第一步：生成调色板，提升GIF色彩质量
        const paletteCommand = [
          '-ss', config.value.startTime,
          '-t', String(config.value.duration), // 截取时长
          '-i', inputFileName,
          '-vf', `fps=${config.value.fps},scale=${config.value.maxWidth}:-2:flags=lanczos,palettegen`,
          '-y',
          paletteFileName
        ]

        // 第二步：用调色板生成高质量GIF
        const gifCommand = [
          '-ss', config.value.startTime,
          '-t', String(config.value.duration),
          '-i', inputFileName,
          '-i', paletteFileName,
          '-filter_complex', `fps=${config.value.fps},scale=${config.value.maxWidth}:-2:flags=lanczos[x];[x][1:v]paletteuse`,
          '-y',
          outputFileName
        ]

        // 先执行调色板生成，设置keepInputFile为true以保留输入文件供后续使用
        await ffmpegWorker.execCommand({
          file,
          inputFileName,
          outputFileName: paletteFileName,
          command: paletteCommand,
          keepInputFile: true
        })

        // 再执行GIF生成，复用已经写入的输入文件
        const result = await ffmpegWorker.execCommand({
          file: null, // 不传递文件对象，避免重复写入
          inputFileName,
          outputFileName,
          command: gifCommand,
          onProgress: (progress) => {
            fileUploadRef.value.updateFileStatus(i, 'processing', { progress: progress > 0 ? progress : 50 })
          }
        })

        // 处理结果
        const { fileData, fileName } = result
        const resultBlob = new Blob([fileData], { type: 'image/gif' })
        const resultUrl = URL.createObjectURL(resultBlob)

        fileUploadRef.value.updateFileStatus(i, 'success', {
          resultFile: { blob: resultBlob, url: resultUrl, fileName },
          resultSize: formatFileSize(resultBlob.size)
        })
        successCount++

      } catch (err) {
        console.error(`文件${fileItem.fileName}转GIF失败：`, err)
        fileUploadRef.value.updateFileStatus(i, 'failed', { errorMsg: err.message })
        failList.push({ fileName: fileItem.fileName, error: err.message })
      }
    }

    // 结果提示
    if (failList.length === 0) {
      ElMessage.success(`全部转换完成！成功生成${successCount}个GIF文件`)
    } else {
      ElMessage.warning(`处理完成，成功${successCount}个，失败${failList.length}个`)
    }

  } catch (err) {
    console.error('批量转GIF失败：', err)
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
  fileList.value = []
  fileUploadRef.value?.handleClearAll()
}

// 组件销毁时释放内存
onUnmounted(() => {
  ffmpegWorker.destroy()
})
</script>

<style scoped>
.video-to-gif-page {
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