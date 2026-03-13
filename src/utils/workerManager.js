/**
 * Web Worker 管理工具
 * 统一封装ffmpeg Worker的初始化、通信、销毁逻辑，所有模块通用
 */

class FfmpegWorkerManager {
  constructor() {
    this.worker = null // Worker实例
    this.isLoaded = false // ffmpeg是否加载完成
    this.pendingPromise = null // 等待中的Promise，用于异步等待结果
    this.progressCallback = null // 进度回调函数
  }

  /**
   * 初始化Worker，加载ffmpeg核心
   * @param {Function} onProgress 进度回调函数，可选
   * @returns {Promise<boolean>} 加载是否成功
   */
  async init(onProgress) {
    // 如果已经初始化过，直接返回成功
    if (this.worker && this.isLoaded) return true

    // 保存进度回调
    if (onProgress) this.progressCallback = onProgress

    return new Promise((resolve, reject) => {
      // 创建Worker实例，路径和第一阶段的Worker文件对应
      this.worker = new Worker(new URL('../workers/ffmpeg.worker.js', import.meta.url), {
        type: 'module'
      })

      // 监听Worker发来的消息
      this.worker.onmessage = (e) => {
        const { type, data } = e.data
        switch (type) {
          // ffmpeg加载成功
          case 'load-success':
            this.isLoaded = true
            resolve(true)
            break
          // ffmpeg加载失败
          case 'load-error':
            reject(new Error(data || 'ffmpeg加载失败'))
            break
          // 处理进度更新
          case 'progress':
            if (this.progressCallback) {
              this.progressCallback(data)
            }
            break
          // 转换处理成功
          case 'convert-success':
            if (this.pendingPromise) {
              this.pendingPromise.resolve(data)
              this.pendingPromise = null
            }
            break
          // 转换处理失败
          case 'convert-error':
            if (this.pendingPromise) {
              this.pendingPromise.reject(new Error(data || '处理失败'))
              this.pendingPromise = null
            }
            break
          // 日志输出
          case 'log':
            console.log('ffmpeg Worker日志：', data)
            break
          // 通用错误
          case 'error':
            reject(new Error(data || 'Worker出错'))
            break
        }
      }

      // 监听Worker错误
      this.worker.onerror = (err) => {
        console.error('Worker线程出错：', err)
        reject(new Error(`Worker出错：${err.message}`))
      }

      // 给Worker发消息，让它加载ffmpeg
      this.worker.postMessage({ type: 'load' })
    })
  }

  /**
   * 执行ffmpeg处理命令
   * @param {Object} params 处理参数
   * @param {File} params.file 要处理的源文件
   * @param {string} params.inputFileName 输入文件名（ffmpeg虚拟文件系统用）
   * @param {string} params.outputFileName 输出文件名
   * @param {string[]} params.command ffmpeg执行命令数组，比如 ['-i', 'input.jpg', 'output.webp']
   * @param {Function} params.onProgress 单文件处理进度回调，可选
   * @returns {Promise<Object>} 处理结果，包含文件数据和文件名
   */
  async execCommand(params) {
    // 先确保Worker已经初始化完成
    await this.init(params.onProgress)
    
    // 用Promise包装，等待Worker返回结果
    return new Promise((resolve, reject) => {
      this.pendingPromise = { resolve, reject }
      
      // 给Worker发消息，执行处理命令
      this.worker.postMessage({
        type: 'convert-image',
        data: params
      }, [params.file]) // 用Transferable Objects，减少内存拷贝
    })
  }

  /**
   * 销毁Worker实例，释放内存
   */
  destroy() {
    if (this.worker) {
      this.worker.postMessage({ type: 'destroy' })
      this.worker = null
    }
    this.isLoaded = false
    this.pendingPromise = null
    this.progressCallback = null
  }
}

// 导出单例，全局复用一个Worker实例，避免重复创建
export const ffmpegWorker = new FfmpegWorkerManager()