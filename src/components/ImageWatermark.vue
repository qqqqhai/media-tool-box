<template>
  <div class="image-watermark-page">
    <!-- 水印参数配置区域 -->
    <el-card class="config-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>水印参数配置</span>
        </div>
      </template>
      
      <div class="config-form">
        <el-form :model="config" label-width="120px" inline>
          <!-- 水印内容 -->
          <el-form-item label="水印内容">
            <el-input v-model="config.text" placeholder="请输入水印文字" style="width: 200px;" />
          </el-form-item>

          <!-- 水印位置 -->
          <el-form-item label="水印位置">
            <el-select v-model="config.position" style="width: 150px">
              <el-option label="左上角" value="top-left" />
              <el-option label="右上角" value="top-right" />
              <el-option label="居中" value="center" />
              <el-option label="左下角" value="bottom-left" />
              <el-option label="右下角" value="bottom-right" />
              <el-option label="全屏平铺" value="tile" />
            </el-select>
          </el-form-item>

          <!-- 字体大小 -->
          <el-form-item label="字体大小">
            <el-input-number v-model="config.fontSize" :min="10" :max="500" style="width: 120px;" />
            <span style="margin-left: 4px;">px</span>
          </el-form-item>

          <!-- 字体颜色 -->
          <el-form-item label="字体颜色">
            <el-color-picker v-model="config.color" show-alpha />
          </el-form-item>

          <!-- 透明度 -->
          <el-form-item label="透明度">
            <el-slider
              v-model="config.opacity"
              :min="0"
              :max="100"
              :step="1"
              show-input
              style="width: 200px;"
            />
            <span style="margin-left: 4px;">%</span>
          </el-form-item>

          <!-- 边距（非平铺模式生效） -->
          <el-form-item v-if="config.position !== 'tile'" label="边距">
            <el-input-number v-model="config.margin" :min="0" :max="500" style="width: 120px;" />
            <span style="margin-left: 4px;">px</span>
          </el-form-item>

          <!-- 平铺间距（平铺模式生效） -->
          <el-form-item v-if="config.position === 'tile'" label="平铺间距">
            <el-input-number v-model="config.tileGap" :min="10" :max="1000" style="width: 120px;" />
            <span style="margin-left: 4px;">px</span>
          </el-form-item>

          <!-- 输出格式 -->
          <el-form-item label="输出格式">
            <el-select v-model="config.outputFormat" style="width: 150px">
              <el-option label="保持原格式" value="origin" />
              <el-option label="JPG" value="jpg" />
              <el-option label="PNG" value="png" />
              <el-option label="WebP" value="webp" />
            </el-select>
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
              :disabled="fileList.length === 0 || isProcessing || !config.text"
              @click="handleStartAddWatermark"
              :loading="isProcessing"
            >
              开始批量添加水印
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
// 导入我们封装的通用组件和工具
import FileUploadList from './FileUploadList.vue'
import { ffmpegWorker } from '../utils/workerManager'
import { getFileExt, IMAGE_SUPPORT_CONFIG, formatFileSize } from '../utils/fileUtils'

// 响应式状态
const fileUploadRef = ref(null)
const fileList = ref([])
const isProcessing = ref(false)
// 水印参数配置（带默认值，新手直接用）
const config = ref({
  text: '我的水印', // 水印默认内容
  position: 'bottom-right', // 默认右下角
  fontSize: 36, // 默认字体大小
  color: '#ffffff', // 默认白色
  opacity: 80, // 默认80%透明度
  margin: 20, // 默认边距20px
  tileGap: 200, // 平铺默认间距200px
  outputFormat: 'origin' // 默认保持原格式
})

/**
 * 监听文件列表变化
 */
const handleFileListChange = (files) => {
  fileList.value = files
}

/**
 * 生成ffmpeg的水印命令（核心逻辑）
 * @param {number} imgWidth 图片宽度（ffmpeg里用变量获取）
 * @param {number} imgHeight 图片高度
 * @returns {string[]} ffmpeg滤镜参数
 */
const buildWatermarkCommand = () => {
  const { text, position, fontSize, color, opacity, margin, tileGap } = config.value
  // 把透明度从0-100转成ffmpeg需要的0-1
  const alpha = (opacity / 100).toFixed(2)
  // 处理颜色，把十六进制转成ffmpeg支持的格式，带透明度
  const fontColor = `color=${color}@${alpha}`

  // 不同位置的坐标计算公式（ffmpeg的drawtext滤镜坐标）
  let positionConfig = ''
  switch (position) {
    case 'top-left':
      // 左上角：x=边距，y=边距
      positionConfig = `x=${margin}:y=${margin}`
      break
    case 'top-right':
      // 右上角：x=图片宽度-文字宽度-边距，y=边距
      positionConfig = `x=w-tw-${margin}:y=${margin}`
      break
    case 'center':
      // 居中：x=(图片宽度-文字宽度)/2，y=(图片高度-文字高度)/2
      positionConfig = `x=(w-tw)/2:y=(h-th)/2`
      break
    case 'bottom-left':
      // 左下角：x=边距，y=图片高度-文字高度-边距
      positionConfig = `x=${margin}:y=h-th-${margin}`
      break
    case 'bottom-right':
      // 右下角：x=图片宽度-文字宽度-边距，y=图片高度-文字高度-边距
      positionConfig = `x=w-tw-${margin}:y=h-th-${margin}`
      break
    case 'tile':
      // 全屏平铺：用平铺参数，重复绘制水印
      positionConfig = `x=mod(n*${tileGap},w+tw)-tw:y=mod(trunc(n*${tileGap}/(w+tw))*${tileGap},h+th)-th`
      break
  }

  // 拼接完整的drawtext滤镜命令
  const drawtextFilter = `drawtext=text='${text}':fontsize=${fontSize}:${fontColor}:${positionConfig}`
  return ['-vf', drawtextFilter]
}

/**
 * 开始批量添加水印
 */
const handleStartAddWatermark = async () => {
  if (!config.value.text.trim()) {
    ElMessage.warning('请先输入水印内容')
    return
  }
  if (fileList.value.length === 0) {
    ElMessage.warning('请先选择要添加水印的图片文件')
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

    // 串行处理每个文件（新手友好，避免内存溢出）
    for (let i = 0; i < fileList.value.length; i++) {
      const fileItem = fileList.value[i]
      const file = fileItem.file
      const originExt = getFileExt(file)
      
      // 更新文件状态为处理中
      fileUploadRef.value.updateFileStatus(i, 'processing', { progress: 0 })

      try {
        const inputFileName = `input_${i}_${file.name}`
        // 确定输出文件名和格式
        let outputExt = config.value.outputFormat === 'origin' ? originExt : config.value.outputFormat
        const outputFileName = `watermark_${file.name.replace(/\.[^.]+$/, `.${outputExt}`)}`
        
        // 1. 基础输入输出命令
        let command = ['-i', inputFileName]
        // 2. 拼接水印滤镜命令
        const watermarkParams = buildWatermarkCommand()
        command = command.concat(watermarkParams)
        // 3. 输出文件
        command.push(outputFileName)

        // 调用Worker执行命令
        const result = await ffmpegWorker.execCommand({
          file,
          inputFileName,
          outputFileName,
          command,
          onProgress: (progress) => {
            fileUploadRef.value.updateFileStatus(i, 'processing', { progress })
          }
        })

        // 处理返回的结果
        const { fileData, fileName } = result
        const mimeType = IMAGE_SUPPORT_CONFIG.mimeTypeMap[outputExt] || 'image/octet-stream'
        const resultBlob = new Blob([fileData], { type: mimeType })
        const resultUrl = URL.createObjectURL(resultBlob)

        // 更新文件状态为成功
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
        console.error(`文件${fileItem.fileName}添加水印失败：`, err)
        fileUploadRef.value.updateFileStatus(i, 'failed', {
          errorMsg: err.message
        })
        failList.push({
          fileName: fileItem.fileName,
          error: err.message
        })
      }
    }

    // 全部处理完成后的结果提示
    if (failList.length === 0) {
      ElMessage.success(`全部处理完成！成功给${successCount}个图片添加了水印`)
    } else {
      ElMessage.warning(`处理完成，成功${successCount}个，失败${failList.length}个`)
    }

  } catch (err) {
    console.error('批量添加水印失败：', err)
    ElMessage.error(`处理失败：${err.message || '未知错误'}`)
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

// 组件销毁时，销毁Worker释放内存
onUnmounted(() => {
  ffmpegWorker.destroy()
})
</script>

<style scoped>
.image-watermark-page {
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