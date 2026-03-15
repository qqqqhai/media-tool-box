/**
 * 文件处理通用工具函数
 * 所有模块通用，统一处理文件相关逻辑
 */

/**
 * 支持的文件格式配置
 */
export const FILE_SUPPORT_CONFIG = {
  // 图片格式
  image: {
    exts: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'bmp', 'tiff'],
    mimeTypePrefix: 'image/'
  },
  // 音频格式
  audio: {
    exts: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'wma', 'm4a'],
    mimeTypePrefix: 'audio/'
  },
  // 视频格式
  video: {
    exts: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'],
    mimeTypePrefix: 'video/'
  }
}

/**
 * 支持的图片格式配置（保持向后兼容）
 */
export const IMAGE_SUPPORT_CONFIG = {
  // 支持的输入格式
  inputExts: FILE_SUPPORT_CONFIG.image.exts,
  // 支持的输出格式
  outputExts: ['jpg', 'png', 'webp', 'avif', 'bmp'],
  // 对应的MIME类型
  mimeTypeMap: {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
    bmp: 'image/bmp',
    tiff: 'image/tiff'
  }
}

/**
 * 支持的音频格式配置
 */
export const AUDIO_SUPPORT_CONFIG = {
  // 支持的输入格式
  inputExts: FILE_SUPPORT_CONFIG.audio.exts,
  // 支持的输出格式
  outputExts: ['mp3', 'wav', 'ogg', 'flac', 'aac'],
  // 对应的MIME类型
  mimeTypeMap: {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    aac: 'audio/aac',
    wma: 'audio/wma',
    m4a: 'audio/mp4'
  }
}

/**
 * 视频处理通用配置
 */
export const VIDEO_SUPPORT_CONFIG = {
  // 支持的输入格式
  inputExts: FILE_SUPPORT_CONFIG.video.exts,
  // 支持的输出格式
  outputExts: ['mp4', 'webm', 'avi', 'mov'],
  // 对应MIME类型
  mimeTypeMap: {
    mp4: 'video/mp4',
    webm: 'video/webm',
    avi: 'video/x-msvideo',
    mov: 'video/quicktime',
    flv: 'video/x-flv',
    mkv: 'video/x-matroska'
  }
}


/**
 * 格式化文件大小，把字节转成KB/MB/GB
 * @param {number} bytes 文件字节数
 * @returns {string} 格式化后的大小
 */
export const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

/**
 * 获取文件的扩展名（小写，不带点）
 * @param {File|string} file 文件对象或文件名
 * @returns {string} 扩展名
 */
export const getFileExt = (file) => {
  const fileName = typeof file === 'string' ? file : file.name
  return fileName.split('.').pop().toLowerCase()
}

/**
 * 判断文件类型（图片、音频、视频）
 * @param {File|string} file 文件对象或文件名
 * @returns {string} 文件类型：'image'、'audio'、'video' 或 'unknown'
 */
export const getFileType = (file) => {
  const ext = getFileExt(file)
  
  if (FILE_SUPPORT_CONFIG.image.exts.includes(ext)) {
    return 'image'
  } else if (FILE_SUPPORT_CONFIG.audio.exts.includes(ext)) {
    return 'audio'
  } else if (FILE_SUPPORT_CONFIG.video.exts.includes(ext)) {
    return 'video'
  } else {
    return 'unknown'
  }
}

/**
 * 校验文件是否为支持的图片格式
 * @param {File} file 待校验的文件
 * @returns {Object} 校验结果 { valid: boolean, message: string }
 */
export const validateImageFile = (file) => {
  const ext = getFileExt(file)
  if (!IMAGE_SUPPORT_CONFIG.inputExts.includes(ext)) {
    return {
      valid: false,
      message: `不支持的文件格式：${ext}，仅支持${IMAGE_SUPPORT_CONFIG.inputExts.join('、')}格式`
    }
  }
  return { valid: true, message: '校验通过' }
}

/**
 * 批量校验图片文件，返回有效文件和错误信息
 * @param {File[]} files 文件列表
 * @returns {Object} { validFiles: 有效文件列表, errorList: 错误信息列表 }
 */
export const batchValidateImageFiles = (files) => {
  const validFiles = []
  const errorList = []
  files.forEach(file => {
    const { valid, message } = validateImageFile(file)
    if (valid) {
      validFiles.push(file)
    } else {
      errorList.push({ fileName: file.name, message })
    }
  })
  return { validFiles, errorList }
}

/**
 * 下载单个文件
 * @param {Blob|string} content 文件内容（Blob或ObjectURL）
 * @param {string} fileName 下载后的文件名
 */
export const downloadFile = (content, fileName) => {
  let url = content
  // 如果是Blob，生成ObjectURL
  if (content instanceof Blob) {
    url = URL.createObjectURL(content)
  }
  // 创建a标签触发下载
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  // 清理DOM
  document.body.removeChild(a)
  // 如果是生成的URL，及时释放内存
  if (content instanceof Blob) {
    URL.revokeObjectURL(url)
  }
}

/**
 * 格式化音视频时长（秒数 → 00:00:00格式）
 * @param {number} seconds 总秒数
 * @returns {string} 格式化后的时长
 */
export const formatDuration = (seconds) => {
  if (isNaN(seconds) || seconds < 0) return '00:00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

/**
 * 批量校验音频文件
 * @param {File[]} files 文件列表
 * @returns {Object} { validFiles: 有效文件, errorList: 错误列表 }
 */
export const batchValidateAudioFiles = (files) => {
  const validFiles = []
  const errorList = []
  files.forEach(file => {
    const ext = getFileExt(file)
    if (!AUDIO_SUPPORT_CONFIG.inputExts.includes(ext)) {
      errorList.push({
        fileName: file.name,
        message: `不支持的音频格式：${ext}，仅支持${AUDIO_SUPPORT_CONFIG.inputExts.join('、')}格式`
      })
    } else {
      validFiles.push(file)
    }
  })
  return { validFiles, errorList }
}

/**
 * 批量校验视频文件
 * @param {File[]} files 文件列表
 * @returns {Object} { validFiles: 有效文件, errorList: 错误列表 }
 */
export const batchValidateVideoFiles = (files) => {
  const validFiles = []
  const errorList = []
  files.forEach(file => {
    const ext = getFileExt(file)
    if (!VIDEO_SUPPORT_CONFIG.inputExts.includes(ext)) {
      errorList.push({
        fileName: file.name,
        message: `不支持的视频格式：${ext}，仅支持${VIDEO_SUPPORT_CONFIG.inputExts.join('、')}格式`
      })
    } else {
      validFiles.push(file)
    }
  })
  return { validFiles, errorList }
}
/**
 * 批量下载文件，打包成ZIP（可选进阶功能，先实现单个下载，后续可扩展）
 * 这里先预留接口，后续需要的话，引入jszip即可实现
 */

/**
 * 释放ObjectURL内存，避免内存泄漏
 * @param {string|string[]} urls 要释放的ObjectURL
 */
export const revokeObjectURLs = (urls) => {
  const urlList = Array.isArray(urls) ? urls : [urls]
  urlList.forEach(url => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  })
}