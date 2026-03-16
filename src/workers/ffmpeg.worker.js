/**
 * ffmpeg Web Worker 线程
 * 所有耗时的ffmpeg处理都在这里执行，不阻塞主线程，保证页面流畅
 * 支持通用的ffmpeg命令执行，适配所有图片、音频、视频处理场景
 */
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
// 使用本地路径加载ffmpeg核心文件
const BASE_URL = import.meta.env.BASE_URL || '/'
const CORE_URL = `${BASE_URL}ffmpeg-core.js`
const WASM_URL = `${BASE_URL}ffmpeg-core.wasm`

// 初始化ffmpeg实例
const ffmpeg = new FFmpeg()
let isLoaded = false // 标记ffmpeg是否加载完成

// 监听ffmpeg日志，回传给主线程
ffmpeg.on('log', ({ message }) => {
  self.postMessage({ type: 'log', data: message })
})

// 监听处理进度，实时回传给主线程
ffmpeg.on('progress', ({ progress }) => {
  // 进度转成0-100的整数，方便前端展示
  self.postMessage({ type: 'progress', data: Math.round(progress * 100) })
})

// 监听ffmpeg错误，回传给主线程
ffmpeg.on('error', (err) => {
  self.postMessage({ type: 'error', data: err.message })
})

/**
 * 加载ffmpeg核心文件
 */
const loadFfmpeg = async () => {
  if (isLoaded) {
    console.log('Worker线程：ffmpeg已加载，直接返回')
    return true
  }
  try {
    console.log('Worker线程：开始加载ffmpeg核心...')
    
    // 使用CDN URL加载ffmpeg核心文件
    console.log('Worker线程：使用CDN URL加载ffmpeg核心文件...')
    console.log('Worker线程：核心文件CDN URL:', CORE_URL)
    console.log('Worker线程：WASM文件CDN URL:', WASM_URL)
    
    // 测试CDN链接是否可访问
    console.log('Worker线程：测试CDN链接是否可访问...')
    const coreResponse = await fetch(CORE_URL, { method: 'HEAD' })
    if (!coreResponse.ok) {
      throw new Error(`核心文件CDN访问失败: ${coreResponse.status}`)
    }
    console.log('Worker线程：核心文件CDN访问成功')
    
    const wasmResponse = await fetch(WASM_URL, { method: 'HEAD' })
    if (!wasmResponse.ok) {
      throw new Error(`WASM文件CDN访问失败: ${wasmResponse.status}`)
    }
    console.log('Worker线程：WASM文件CDN访问成功')
    
    // 使用toBlobURL来处理文件，避免Vite添加?import参数导致的500错误
    console.log('Worker线程：创建Blob URL...')
    const coreURL = await toBlobURL(CORE_URL, 'text/javascript')
    const wasmURL = await toBlobURL(WASM_URL, 'application/wasm')
    
    console.log('Worker线程：核心文件Blob URL:', coreURL)
    console.log('Worker线程：WASM文件Blob URL:', wasmURL)
    
    console.log('Worker线程：开始加载ffmpeg...')
    await ffmpeg.load({
      coreURL: CORE_URL,
      wasmURL: WASM_URL
    })
    console.log('Worker线程：ffmpeg加载成功！')
    isLoaded = true
    self.postMessage({ type: 'load-success' })
    return true
  } catch (err) {
    console.error('Worker线程：ffmpeg加载失败', err)
    console.error('Worker线程：错误详情:', err.stack)
    self.postMessage({ type: 'load-error', data: err.message || JSON.stringify(err) || '未知错误' })
    return false
  }
}

/**
 * 执行ffmpeg处理命令
 * @param {Object} params 主线程传来的参数
 */
const handleConvert = async (params) => {
  const { file, inputFileName, outputFileName, command, keepInputFile = false, keepOutputFile = false } = params
  
  // 先确保ffmpeg已加载
  if (!isLoaded) {
    const loadSuccess = await loadFfmpeg()
    if (!loadSuccess) return
  }

  try {
    console.log('Worker线程：开始处理文件', inputFileName)
    
    // 检查文件大小，避免处理过大的文件导致内存溢出
    if (file && file instanceof File) {
      const fileSizeMB = file.size / (1024 * 1024)
      console.log('Worker线程：文件大小:', fileSizeMB.toFixed(2), 'MB')
      // 对于视频文件，限制大小为500MB
      if (fileSizeMB > 500) {
        throw new Error('文件过大，最大支持500MB的文件')
      }
    }
    
    // 1. 把源文件写入ffmpeg的虚拟文件系统（如果文件对象存在）
    if (file) {
      console.log('Worker线程：文件类型:', typeof file)
      console.log('Worker线程：文件是否为File对象:', file instanceof File)
      if (file instanceof File) {
        console.log('Worker线程：文件属性:', Object.keys(file))
        
        // 清理输入文件（如果文件对象存在，重新写入）
        try {
          await ffmpeg.deleteFile(inputFileName)
          console.log('Worker线程：清理旧输入文件成功')
        } catch (e) {
          console.log('Worker线程：清理旧输入文件失败（可能文件不存在）:', e.message)
        }
        
        console.log('Worker线程：开始读取文件...')
        const fileData = await fetchFile(file)
        console.log('Worker线程：文件读取成功，大小:', fileData.length)
        
        console.log('Worker线程：开始写入文件到ffmpeg...')
        await ffmpeg.writeFile(inputFileName, fileData)
        console.log('Worker线程：文件写入成功')
      } else {
        console.log('Worker线程：文件对象不是File类型，跳过写入步骤')
      }
    } else {
      console.log('Worker线程：文件对象为null，跳过写入步骤（文件可能已存在于虚拟文件系统中）')
    }
    
    // 2. 执行ffmpeg命令（核心，命令由主线程传入，适配不同功能）
    console.log('Worker线程：执行命令:', command.join(' '))
    await ffmpeg.exec(command)
    console.log('Worker线程：命令执行成功')
    
    // 3. 读取处理完成的输出文件
    console.log('Worker线程：开始读取处理结果...')
    const outputData = await ffmpeg.readFile(outputFileName)
    console.log('Worker线程：处理结果读取成功，大小:', outputData.length)
    
    console.log('Worker线程：文件处理完成', outputFileName)
    // 4. 把处理结果回传给主线程，用Transferable优化内存
    self.postMessage({
      type: 'convert-success',
      data: {
        fileData: outputData.buffer,
        fileName: outputFileName
      }
    }, [outputData.buffer])

  } catch (err) {
    console.error('Worker线程：处理失败', err)
    console.error('Worker线程：错误详情:', err.stack)
    // 处理不同类型的错误
    if (err.message && err.message.includes('memory access out of bounds')) {
      self.postMessage({ type: 'convert-error', data: '处理失败：内存不足，请尝试使用较小的视频文件' })
    } else if (err.message && err.message.includes('ErrnoError: FS error')) {
      self.postMessage({ type: 'convert-error', data: '处理失败：文件系统错误，请尝试重新选择文件' })
    } else {
      self.postMessage({ type: 'convert-error', data: err.message || JSON.stringify(err) })
    }
  } finally {
    // 5. 清理虚拟文件系统里的临时文件，释放内存
    try {
      // 清理输入文件（如果不保留）
      if (inputFileName && !keepInputFile) {
        try {
          await ffmpeg.deleteFile(inputFileName)
          console.log('Worker线程：清理输入文件成功:', inputFileName)
        } catch (e) {
          console.log('Worker线程：清理输入文件失败:', e.message)
        }
      } else if (keepInputFile) {
        console.log('Worker线程：保留输入文件:', inputFileName)
      }
      
      // 清理输出文件（某些场景需要跨命令复用输出文件时，可以通过 keepOutputFile 控制保留）
      if (!keepOutputFile && outputFileName && outputFileName !== inputFileName) {
        try {
          // 尝试删除文件，忽略错误
          await ffmpeg.deleteFile(outputFileName)
          // 只有在成功删除时才显示日志
          console.log('Worker线程：清理输出文件成功:', outputFileName)
        } catch (e) {
          // 忽略清理错误，不影响主流程
        }
      }
      
      // 清理可能的临时文件（如固定命名的palette.png）
      try {
        // 尝试删除palette.png，忽略错误
        await ffmpeg.deleteFile('palette.png')
      } catch (e) {
        // 忽略错误，可能文件不存在
      }
      
      console.log('Worker线程：临时文件清理成功')
    } catch (e) {
      // 忽略清理错误
    }
  }
}

// 监听主线程发来的消息
self.onmessage = async (e) => {
  const { type, data } = e.data

  switch (type) {
    // 主线程要求加载ffmpeg
    case 'load':
      await loadFfmpeg()
      break
    // 主线程要求执行处理命令
    case 'convert-image':
    case 'convert':
      await handleConvert(data)
      break
    // 主线程要求销毁实例
    case 'destroy':
      if (ffmpeg.loaded) {
        await ffmpeg.terminate()
        isLoaded = false
      }
      self.close() // 关闭Worker线程
      break
  }
}