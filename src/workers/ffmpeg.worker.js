// 子线程：ffmpeg处理Worker，所有耗时操作都在这里执行，不阻塞主线程
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

const ffmpeg = new FFmpeg()
let isLoaded = false

// 日志、进度、错误监听
ffmpeg.on('log', ({ message }) => self.postMessage({ type: 'log', data: message }))
ffmpeg.on('progress', ({ progress }) => self.postMessage({ type: 'progress', data: Math.round(progress * 100) }))
ffmpeg.on('error', (err) => self.postMessage({ type: 'error', data: err.message }))

// 加载本地单线程ffmpeg核心，彻底避开worker.js
const loadFfmpeg = async () => {
  if (isLoaded) return true
  try {
    // 使用toBlobURL来处理文件，避免Vite添加?import参数导致的500错误
    const coreURL = await toBlobURL('/ffmpeg-core.js', 'text/javascript')
    const wasmURL = await toBlobURL('/ffmpeg-core.wasm', 'application/wasm')
    
    self.postMessage({ type: 'log', data: `核心文件URL: ${coreURL}` })
    self.postMessage({ type: 'log', data: `WASM文件URL: ${wasmURL}` })
    
    await ffmpeg.load({
      coreURL,
      wasmURL
    })
    isLoaded = true
    self.postMessage({ type: 'load-success' })
    return true
  } catch (err) {
    self.postMessage({ type: 'load-error', data: err.message || 'undefined' })
    return false
  }
}

// 监听主线程消息
self.onmessage = async (e) => {
  const { type, data } = e.data
  if (type === 'load') await loadFfmpeg()
  
  if (type === 'convert-image') {
    const { file, inputFileName, outputFileName, command } = data
    if (!isLoaded) {
      const loadSuccess = await loadFfmpeg()
      if (!loadSuccess) return
    }
    try {
      self.postMessage({ type: 'log', data: `开始处理文件: ${inputFileName}` })
      self.postMessage({ type: 'log', data: `执行命令: ${command.join(' ')}` })
      
      await ffmpeg.writeFile(inputFileName, await fetchFile(file))
      self.postMessage({ type: 'log', data: '文件写入成功' })
      
      await ffmpeg.exec(command)
      self.postMessage({ type: 'log', data: '命令执行成功' })
      
      const outputData = await ffmpeg.readFile(outputFileName)
      self.postMessage({ type: 'log', data: '读取结果成功' })
      
      self.postMessage({
        type: 'convert-success',
        data: { fileData: outputData.buffer, fileName: outputFileName }
      }, [outputData.buffer])
      
      await ffmpeg.deleteFile(inputFileName)
      await ffmpeg.deleteFile(outputFileName)
      self.postMessage({ type: 'log', data: '清理临时文件成功' })
    } catch (err) {
      self.postMessage({ type: 'log', data: `错误详情: ${JSON.stringify(err)}` })
      self.postMessage({ type: 'convert-error', data: err.message || JSON.stringify(err) || '未知错误' })
    }
  }

  if (type === 'destroy') {
    if (ffmpeg.loaded) await ffmpeg.terminate()
    self.close()
  }
}