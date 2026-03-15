<template>
  <div class="video-compress-page">
    <!-- 参数配置区域 -->
    <el-card class="config-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>压缩参数配置</span>
        </div>
      </template>
      
      <div class="config-form">
        <el-form :model="config" label-width="120px" inline>
          <!-- 压缩画质配置 -->
          <el-form-item label="压缩画质">
            <el-select v-model="config.crf" style="width: 180px">
              <el-option label="高画质（体积稍大）" value="23" />
              <el-option label="平衡画质与体积（推荐）" value="28" />
              <el-option label="小体积优先" value="35" />
              <el-option label="极致压缩" value="40" />
            </el-select>
          </el-form-item>
          <!-- 分辨率限制 -->
          <el-form-item label="分辨率限制">
            <el-select v-model="config.maxResolution" style="width: 180px">
              <el-option label="不限制" value="0" />
              <el-option label="1080p（1920×1080）" value="1080" />
              <el-option label="720p（1280×720）" value="720" />
              <el-option label="480p（854×480）" value="480" />
            </el-select>
          </el-form-item>
          <!-- 音频码率配置 -->
          <el-form-item label="音频码率">
            <el-select v-model="config.audioBitrate" style="width: 180px">
              <el-option label="高音质 192k" value="192k" />
              <el-option label="标准音质 128k" value="128k" />
              <el-option label="低音质 64k" value="64k" />
            </el-select>
          </el-form-item>
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
// 压缩参数配置
const config = ref({
  crf: '28', // 平衡画质和体积的推荐值
  maxResolution: '0', // 0=不限制分辨率
  audioBitrate: '128k' // 标准音频码率
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
    ElMessage.warning('请先选择要压缩的视频文件')
    return
  }
  if (isProcessing.value) return

  isProcessing.value = true
  let successCount = 0
  const failList = []

  try {
    ElMessage.info('正在初始化ffmpeg核心...')
    await ffmpegWorker.init()

    // 串行处理，避免内存溢出
    for (let i = 0; i < fileList.value.length; i++) {
      const fileItem = fileList.value[i]
      const file = fileItem.file
      
      fileUploadRef.value.updateFileStatus(i, 'processing', { progress: 0 })

      try {
        const inputFileName = `video_compress_${i}_${file.name}`
        const outputFileName = `compressed_${file.name}`
        // 统一输出MP4格式，兼容性最好
        const outputExt = 'mp4'

        // 拼接压缩核心命令
        let command = [
          '-i', inputFileName,
          '-c:v', 'libx264', // 强制H.264编码，兼容性最好
          '-crf', config.value.crf,
          '-preset', 'medium',
          '-c:a', 'aac', // 音频用AAC编码
          '-b:a', config.value.audioBitrate,
          '-y',
          outputFileName
        ]

        // 如果限制了分辨率，添加缩放滤镜
        if (config.value.maxResolution !== '0') {
          const maxHeight = config.value.maxResolution
          // scale滤镜：-2表示宽度按比例缩放，且保证是偶数（H.264编码要求宽高是偶数）
          const scaleFilter = `scale=-2:'min(ih,${maxHeight})'`
          // 把缩放滤镜插入到命令里
          command.splice(4, 0, '-vf', scaleFilter)
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
        const mimeType = VIDEO_SUPPORT_CONFIG.mimeTypeMap.mp4
        const resultBlob = new Blob([fileData], { type: mimeType })
        const resultUrl = URL.createObjectURL(resultBlob)

        fileUploadRef.value.updateFileStatus(i, 'success', {
          resultFile: { blob: resultBlob, url: resultUrl, fileName },
          resultSize: formatFileSize(resultBlob.size)
        })
        successCount++

      } catch (err) {
        console.error(`文件${fileItem.fileName}压缩失败：`, err)
        fileUploadRef.value.updateFileStatus(i, 'failed', { errorMsg: err.message })
        failList.push({ fileName: fileItem.fileName, error: err.message })
      }
    }

    // 结果提示
    if (failList.length === 0) {
      ElMessage.success(`全部压缩完成！成功处理${successCount}个视频文件`)
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
  fileUploadRef.value?.handleClearAll()
}

// 组件销毁时释放内存
onUnmounted(() => {
  ffmpegWorker.destroy()
})
</script>

<style scoped>
.video-compress-page {
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