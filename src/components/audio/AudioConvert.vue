<template>
  <div class="audio-convert-page">
    <!-- 参数配置区域 -->
    <el-card class="config-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>转换参数配置</span>
        </div>
      </template>
      
      <div class="config-form">
        <el-form :model="config" label-width="120px" inline>
          <!-- 目标输出格式 -->
          <el-form-item label="目标输出格式">
            <el-select v-model="config.outputFormat" style="width: 180px">
              <el-option label="MP3（通用）" value="mp3" />
              <el-option label="WAV（无损）" value="wav" />
              <el-option label="M4A" value="m4a" />
              <el-option label="AAC" value="aac" />
              <el-option label="OGG" value="ogg" />
            </el-select>
          </el-form-item>
          <!-- 音频码率/质量配置 -->
          <el-form-item label="音频质量">
            <el-select v-model="config.bitrate" style="width: 180px">
              <el-option label="低音质（小体积）" value="64k" />
              <el-option label="标准音质" value="128k" />
              <el-option label="高音质" value="192k" />
              <el-option label="无损音质" value="320k" />
            </el-select>
          </el-form-item>
        </el-form>
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
// 导入通用组件和工具
import FileUploadList from '../FileUploadList.vue'
import { ffmpegWorker } from '../../utils/workerManager'
import { getFileExt, formatFileSize, AUDIO_SUPPORT_CONFIG } from '../../utils/fileUtils'

// 响应式状态
const fileUploadRef = ref(null)
const fileList = ref([])
const isProcessing = ref(false)
// 转换参数配置
const config = ref({
  outputFormat: 'mp3', // 默认转MP3
  bitrate: '128k' // 默认标准音质
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
    ElMessage.warning('请先选择要转换的音频文件')
    return
  }
  if (isProcessing.value) return

  isProcessing.value = true
  let successCount = 0
  const failList = []

  try {
    // 先初始化Worker，加载ffmpeg核心
    ElMessage.info('正在初始化ffmpeg核心，首次加载可能需要几秒...')
    await ffmpegWorker.init()

    // 串行处理每个文件（新手友好，避免内存溢出）
    for (let i = 0; i < fileList.value.length; i++) {
      const fileItem = fileList.value[i]
      const file = fileItem.file
      
      // 更新文件状态为处理中
      fileUploadRef.value.updateFileStatus(i, 'processing', { progress: 0 })

      try {
        // 1. 定义输入输出文件名
        const inputFileName = `audio_input_${i}_${file.name}`
        // 替换文件扩展名为目标格式
        const outputFileName = file.name.replace(/\.[^.]+$/, `.${config.value.outputFormat}`)
        
        // 2. 拼接ffmpeg转换命令
        const command = [
          '-i', inputFileName, // 输入文件
          '-b:a', config.value.bitrate, // 设置音频码率
          '-y', // 强制覆盖输出文件
          outputFileName // 输出文件
        ]

        // 3. 调用Worker执行命令
        const result = await ffmpegWorker.execCommand({
          file,
          inputFileName,
          outputFileName,
          command,
          // 监听处理进度
          onProgress: (progress) => {
            fileUploadRef.value.updateFileStatus(i, 'processing', { progress })
          }
        })

        // 4. 处理返回结果
        const { fileData, fileName } = result
        const mimeType = AUDIO_SUPPORT_CONFIG.mimeTypeMap[config.value.outputFormat] || 'audio/mpeg'
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

    // 全部处理完成，给出结果提示
    if (failList.length === 0) {
      ElMessage.success(`全部转换完成！成功处理${successCount}个音频文件`)
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
.audio-convert-page {
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