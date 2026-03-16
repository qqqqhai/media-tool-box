<template>
  <div class="test-ffmpeg">
    <h2>ffmpeg最简验证demo</h2>
    
    <el-button 
      type="primary" 
      @click="handleLoad" 
      :loading="isLoading"
      :disabled="ffmpegLoaded"
    >
      {{ ffmpegLoaded ? 'ffmpeg已加载完成' : '加载ffmpeg核心' }}
    </el-button>

    <el-upload
      action="#"
      :auto-upload="false"
      :show-file-list="false"
      :on-change="handleSelectFile"
      accept="image/jpg,image/jpeg,image/png"
      :disabled="!ffmpegLoaded"
      style="margin-left: 10px;"
    >
      <el-button type="primary" :disabled="!ffmpegLoaded">选择图片转换</el-button>
    </el-upload>

    <!-- 状态提示 -->
    <el-alert v-if="isLoading" title="正在处理中，请稍候..." type="info" style="margin: 10px 0" />
    <el-alert v-if="errorMsg" :title="errorMsg" type="error" style="margin: 10px 0" show-close @close="errorMsg = ''" />
    <el-alert v-if="ffmpegLoaded" title="✅ ffmpeg加载成功，可以开始转换图片了" type="success" style="margin: 10px 0" />

    <!-- 预览区域 -->
    <div class="preview-box" style="margin-top: 20px; display: flex; gap: 20px; flex-wrap: wrap;">
      <div v-if="originFileUrl" class="preview-item">
        <h3>原图</h3>
        <img :src="originFileUrl" alt="原图" style="max-width: 300px; margin-top: 10px;" />
        <p>文件名：{{ originFile.name }}</p>
        <p>大小：{{ (originFile.size / 1024).toFixed(2) }} KB</p>
      </div>

      <div v-if="resultFileUrl" class="preview-item">
        <h3>处理后(WebP)</h3>
        <img :src="resultFileUrl" alt="处理后" style="max-width: 300px; margin-top: 10px;" />
        <p>文件名：{{ resultFile.name }}</p>
        <p>大小：{{ (resultFile.size / 1024).toFixed(2) }} KB</p>
        <el-button type="success" style="margin-top: 10px" @click="handleDownload">下载文件</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted, watch } from 'vue'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

// 响应式变量
const isLoading = ref(false)
const errorMsg = ref('')
const originFile = ref(null)
const originFileUrl = ref('')
const resultFile = ref(null)
const resultFileUrl = ref('')
const ffmpegLoaded = ref(false)

// 初始化ffmpeg实例
const ffmpeg = new FFmpeg()

// 监听ffmpeg加载状态
watch(() => ffmpeg.loaded, (newValue) => {
  ffmpegLoaded.value = newValue
  console.log('ffmpeg加载状态变化：', newValue)
})

// 日志监听，方便调试
ffmpeg.on('log', ({ message }) => console.log('ffmpeg日志：', message))
ffmpeg.on('progress', ({ progress }) => console.log('处理进度：', (progress * 100).toFixed(2) + '%'))
ffmpeg.on('error', (err) => {
  const msg = err && (err.message || String(err))
  // 忽略 ffmpeg.wasm 内部的非致命 FS 错误，避免干扰正式功能验证
  if (msg && msg.includes('ErrnoError: FS error')) {
    console.warn('ffmpeg内部FS错误（已忽略）：', msg)
    return
  }
  console.error('ffmpeg错误：', err)
  errorMsg.value = `出错：${msg}`
})

// 核心：加载ffmpeg（单独拆出来，先加载再处理，避免和文件逻辑混在一起）
const handleLoad = () => {
  if (ffmpegLoaded.value) return
  isLoading.value = true
  errorMsg.value = ''
  
  console.log('🔄 开始加载ffmpeg核心...')
  
  // 使用Promise的then/catch语法，避免阻塞主线程
  const loadPromise = new Promise(async (resolve, reject) => {
    try {
      // 添加超时处理
      const timeoutId = setTimeout(() => reject(new Error('加载超时（30秒）')), 30000)
      
      console.log('使用本地文件加载方式...')
      // 使用toBlobURL来处理文件，避免模块加载问题
      const BASE_URL = import.meta.env.BASE_URL || '/'
      const coreURL = await toBlobURL(`${BASE_URL}ffmpeg-core.js`, 'text/javascript')
      const wasmURL = await toBlobURL(`${BASE_URL}ffmpeg-core.wasm`, 'application/wasm')
      
      console.log('核心文件URL:', coreURL)
      console.log('WASM文件URL:', wasmURL)
      
      await ffmpeg.load({
        coreURL,
        wasmURL
      })
      
      clearTimeout(timeoutId)
      console.log('✅ ffmpeg加载完成！')
      resolve()
    } catch (err) {
      reject(err)
    }
  })
  
  loadPromise.then(() => {
    // 加载成功
    ffmpegLoaded.value = ffmpeg.loaded
    console.log('最终加载状态：', ffmpegLoaded.value)
  }).catch(async (err) => {
    // 自动加载失败，尝试本地加载
    console.error('❌ 自动加载失败：', err)
    
    try {
      console.log('🔄 尝试使用本地加载方式...')
      // 检查是否存在本地核心文件
      const BASE_URL = import.meta.env.BASE_URL || '/'
      const localCoreURL = `${BASE_URL}ffmpeg-core.js`
      const localWasmURL = `${BASE_URL}ffmpeg-core.wasm`
      
      console.log('本地核心文件URL:', localCoreURL)
      console.log('本地WASM文件URL:', localWasmURL)
      
      // 测试本地文件是否存在
      const localResponse = await fetch(localCoreURL, { method: 'HEAD', timeout: 5000 })
      if (!localResponse.ok) {
        throw new Error(`本地文件不存在: ${localResponse.status}`)
      }
      console.log('本地文件存在')
      
      // 加载本地核心文件
      await ffmpeg.load({
        coreURL: localCoreURL,
        wasmURL: localWasmURL
      })
      console.log('✅ 本地加载完成！')
      ffmpegLoaded.value = ffmpeg.loaded
    } catch (err2) {
      console.error('❌ 本地加载失败：', err2)
      errorMsg.value = `加载失败：${err2.message}\n详细错误：${JSON.stringify(err2, null, 2)}`
    }
  }).finally(() => {
    isLoading.value = false
    // 强制检查加载状态
    ffmpegLoaded.value = ffmpeg.loaded
    console.log('最终加载状态：', ffmpegLoaded.value)
  })
}

// 选择图片并转换
const handleSelectFile = (uploadFile) => {
  const file = uploadFile.raw
  if (!file || !ffmpegLoaded.value) return

  // 重置状态
  originFile.value = file
  resultFile.value = null
  resultFileUrl.value = ''
  originFileUrl.value = URL.createObjectURL(file)
  isLoading.value = true
  errorMsg.value = ''

  // 使用Promise的then/catch语法，避免阻塞主线程
  const processPromise = new Promise(async (resolve, reject) => {
    try {
      const inputName = `input_${file.name}`
      const outputName = file.name.replace(/\.(jpg|jpeg|png)$/i, '.webp')

      console.log('🔄 写入文件到ffmpeg...')
      await ffmpeg.writeFile(inputName, await fetchFile(file))

      console.log('🔄 执行转换命令...')
      await ffmpeg.exec(['-i', inputName, '-q:v', '0', outputName])

      console.log('🔄 读取处理结果...')
      const data = await ffmpeg.readFile(outputName)
      const blob = new Blob([data.buffer], { type: 'image/webp' })
      resultFile.value = new File([blob], outputName, { type: 'image/webp' })
      resultFileUrl.value = URL.createObjectURL(blob)

      // 清理临时文件
      await ffmpeg.deleteFile(inputName)
      await ffmpeg.deleteFile(outputName)
      console.log('✅ 转换完成！')
      resolve()
    } catch (err) {
      reject(err)
    }
  })

  processPromise.then(() => {
    // 处理成功
    console.log('处理完成')
  }).catch((err) => {
    // 处理失败
    console.error('❌ 转换失败：', err)
    errorMsg.value = `转换失败：${err.message}`
  }).finally(() => {
    isLoading.value = false
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

// 释放内存
onUnmounted(() => {
  if (originFileUrl.value) URL.revokeObjectURL(originFileUrl.value)
  if (resultFileUrl.value) URL.revokeObjectURL(resultFileUrl.value)
})
</script>

<style scoped>
.test-ffmpeg {
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}
</style>