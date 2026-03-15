<template>
  <div class="video-convert-page">
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
              <el-option label="MP4（全平台兼容）" value="mp4" />
              <el-option label="WEBM（网页专用小体积）" value="webm" />
              <el-option label="MOV（苹果设备专用）" value="mov" />
              <el-option label="AVI" value="avi" />
            </el-select>
          </el-form-item>
          <!-- 视频质量配置 -->
          <el-form-item label="视频画质">
            <el-select v-model="config.crf" style="width: 180px">
              <el-option label="无损画质（大体积）" value="18" />
              <el-option label="高画质" value="23" />
              <el-option label="标准画质（推荐）" value="28" />
              <el-option label="低画质（极小体积）" value="35" />
            </el-select>
          </el-form-item>
        </el-form>
        <el-alert type="info" description="CRF值越小，画质越高，文件体积越大；日常使用推荐23-28" show-icon style="margin-top: 10px;" />
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

      <!-- 复用通用上传列表组件 -->
      <FileUploadList
        ref="fileUploadRef"
        accept=".mp4,.mov,.avi,.mkv,.flv,.webm,.wmv"
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
// 导入通用组件和工具
import FileUploadList from '../FileUploadList.vue'
import { ffmpegWorker } from '../../utils/workerManager'
import { getFileExt, formatFileSize, VIDEO_SUPPORT_CONFIG } from '../../utils/fileUtils'

// 响应式状态
const fileUploadRef = ref(null)
const fileList = ref([])
const isProcessing = ref(false)
// 转换参数配置（新手直接用默认值即可）
const config = ref({
  outputFormat: 'mp4', // 默认转MP4，兼容性最好
  crf: '23' // 23是H.264编码的官方默认值，平衡画质和体积
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
    ElMessage.warning('请先选择要转换的视频文件')
    return
  }
  if (isProcessing.value) return

  isProcessing.value = true
  let successCount = 0
  const failList = []

  try {
    // 初始化ffmpeg，首次加载会下载wasm文件，耐心等待
    ElMessage.info('正在初始化ffmpeg核心，首次加载可能需要几秒...')
    await ffmpegWorker.init()

    // 【关键】串行处理，一个视频处理完再处理下一个，避免内存溢出
    for (let i = 0; i < fileList.value.length; i++) {
      const fileItem = fileList.value[i]
      const file = fileItem.file
      
      // 更新文件状态为处理中
      fileUploadRef.value.updateFileStatus(i, 'processing', { progress: 0 })

      try {
        // 1. 定义输入输出文件名（避免文件名有特殊符号出问题）
        const inputFileName = `video_convert_${i}_${file.name}`
        // 把原文件的扩展名替换成目标格式
        const outputFileName = file.name.replace(/\.[^.]+$/, `.${config.value.outputFormat}`)
        const targetFormat = config.value.outputFormat

        // 2. 拼接ffmpeg转换核心命令
        let command = [
          '-i', inputFileName, // 输入文件
          '-crf', config.value.crf, // 画质控制参数
          '-preset', 'medium', // 编码速度预设，medium平衡速度和压缩率
          '-y', // 强制覆盖输出文件，避免报错
          outputFileName // 输出文件
        ]

        // 【关键兼容处理】转MP4强制用H.264编码+AAC音频，全平台兼容
        if (targetFormat === 'mp4' || targetFormat === 'mov') {
          // 在命令里插入编码配置，位置在输入文件之后
          command.splice(2, 0, '-c:v', 'libx264', '-c:a', 'aac')
        }

        // 3. 调用Worker线程执行命令，不阻塞主线程
        const result = await ffmpegWorker.execCommand({
          file,
          inputFileName,
          outputFileName,
          command,
          // 监听处理进度，实时更新到页面
          onProgress: (progress) => {
            fileUploadRef.value.updateFileStatus(i, 'processing', { progress })
          }
        })

        // 4. 处理执行结果
        const { fileData, fileName } = result
        const mimeType = VIDEO_SUPPORT_CONFIG.mimeTypeMap[targetFormat] || 'video/mp4'
        const resultBlob = new Blob([fileData], { type: mimeType })
        const resultUrl = URL.createObjectURL(resultBlob)

        // 5. 更新文件状态为成功，保存结果
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
        // 单个文件处理失败，不中断整个批量任务
        console.error(`文件${fileItem.fileName}转换失败：`, err)
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
      ElMessage.success(`全部转换完成！成功处理${successCount}个视频文件`)
    } else {
      ElMessage.warning(`处理完成，成功${successCount}个，失败${failList.length}个`)
    }

  } catch (err) {
    // 全局错误处理
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

// 组件销毁时，销毁Worker线程，彻底释放内存
onUnmounted(() => {
  ffmpegWorker.destroy()
})
</script>

<style scoped>
.video-convert-page {
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