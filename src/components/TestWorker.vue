<template>
  <div class="test-worker">
    <h2>Web Worker非阻塞处理验证demo</h2>
    
    <!-- 文件选择按钮 -->
    <el-upload
      action="#"
      :auto-upload="false"
      :show-file-list="false"
      :on-change="handleSelectFile"
      accept="image/jpg,image/jpeg,image/png"
      :disabled="isProcessing"
    >
      <el-button type="primary" :loading="isProcessing">选择图片用Worker转换</el-button>
    </el-upload>

    <!-- 页面流畅度验证 -->
    <div style="margin: 15px 0;">
      <el-button @click="count += 1">点击我+1</el-button>
      <span style="margin-left: 10px; font-size: 18px;">当前计数：{{ count }}</span>
      <p style="color: #666; font-size: 14px; margin-top: 5px;">验证：转换过程中疯狂点击按钮，数字正常增加=页面不卡顿，Worker生效</p>
    </div>

    <!-- 进度提示 -->
    <el-progress v-if="isProcessing && progress > 0" :percentage="progress" style="margin: 10px 0; width: 500px;" />
    
    <!-- 错误提示 -->
    <el-alert v-if="errorMsg" :title="errorMsg" type="error" style="margin: 10px 0" show-close @close="errorMsg = ''" />

    <!-- 预览区域 -->
    <div class="preview-box" style="margin-top: 20px; display: flex; gap: 20px; flex-wrap: wrap;">
      <!-- 原图 -->
      <div v-if="originFileUrl" class="preview-item">
        <h3>原图</h3>
        <img :src="originFileUrl" alt="原图" style="max-width: 300px; margin-top: 10px; border: 1px solid #eee;" />
        <p>文件名：{{ originFile.name }}</p>
        <p>大小：{{ (originFile.size / 1024).toFixed(2) }} KB</p>
      </div>

      <!-- 处理后 -->
      <div v-if="resultFileUrl" class="preview-item">
        <h3>处理后(WebP格式)</h3>
        <img :src="resultFileUrl" alt="处理后" style="max-width: 300px; margin-top: 10px; border: 1px solid #eee;" />
        <p>文件名：{{ resultFile.name }}</p>
        <p>大小：{{ (resultFile.size / 1024).toFixed(2) }} KB</p>
        <el-button type="success" style="margin-top: 10px" @click="handleDownload">下载处理后的文件</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'

// 响应式变量
const count = ref(0)
const isProcessing = ref(false)
const progress = ref(0)
const errorMsg = ref('')
const originFile = ref(null)
const originFileUrl = ref('')
const resultFile = ref(null)
const resultFileUrl = ref('')

// 初始化Worker线程
let worker = null
const initWorker = () => {
  // 避免重复创建
  if (worker) return
  // 创建Worker实例，路径完全适配你的项目结构
  worker = new Worker(new URL('../workers/ffmpeg.worker.js', import.meta.url), {
    type: 'module'
  })

  // 监听Worker发来的消息
  worker.onmessage = (e) => {
    const { type, data } = e.data
    switch (type) {
      case 'log':
        console.log('Worker日志：', data)
        break
      case 'progress':
        progress.value = data
        break
      case 'load-success':
        console.log('主线程：Worker加载ffmpeg成功')
        break
      case 'load-error':
        isProcessing.value = false
        errorMsg.value = `ffmpeg加载失败：${data}`
        break
      case 'convert-success':
        // 处理Worker返回的结果
        const { fileData, fileName } = data
        const blob = new Blob([fileData], { type: 'image/webp' })
        resultFile.value = new File([blob], fileName, { type: 'image/webp' })
        resultFileUrl.value = URL.createObjectURL(blob)
        isProcessing.value = false
        progress.value = 0
        console.log('主线程：转换完成')
        break
      case 'convert-error':
        isProcessing.value = false
        errorMsg.value = `处理失败：${data}`
        progress.value = 0
        break
      case 'error':
        errorMsg.value = `出错：${data}`
        break
    }
  }

  // 监听Worker错误
  worker.onerror = (err) => {
    console.error('Worker线程出错：', err)
    errorMsg.value = `Worker出错：${err.message}`
    isProcessing.value = false
  }
}

// 处理用户选择的文件
const handleSelectFile = async (uploadFile) => {
  const file = uploadFile.raw
  if (!file) return

  // 重置状态
  originFile.value = file
  resultFile.value = null
  resultFileUrl.value = ''
  errorMsg.value = ''
  originFileUrl.value = URL.createObjectURL(file)
  isProcessing.value = true
  progress.value = 0

  // 初始化Worker
  initWorker()

  // 生成唯一的文件名，避免冲突
  const timestamp = Date.now()
  const uniqueInputName = `input_${timestamp}_${file.name}`
  const uniqueOutputName = `output_${timestamp}_${file.name.replace(/\.(jpg|jpeg|png)$/i, '.webp')}`

  // 给Worker发消息，执行转换
  worker.postMessage({
    type: 'convert-image',
    data: {
      file: file,
      inputFileName: uniqueInputName,
      outputFileName: uniqueOutputName,
      command: ['-i', uniqueInputName, '-q:v', '0', uniqueOutputName]
    }
  })
}

// 下载文件
const handleDownload = () => {
  if (!resultFileUrl.value || !resultFile.value) return
  const a = document.createElement('a')
  a.href = resultFileUrl.value
  a.download = resultFile.value.name
  a.click()
}

// 组件销毁时，关闭Worker，释放内存
onUnmounted(() => {
  if (originFileUrl.value) URL.revokeObjectURL(originFileUrl.value)
  if (resultFileUrl.value) URL.revokeObjectURL(resultFileUrl.value)
  if (worker) {
    worker.postMessage({ type: 'destroy' })
    worker = null
  }
})
</script>

<style scoped>
.test-worker {
  margin-top: 30px;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}
</style>