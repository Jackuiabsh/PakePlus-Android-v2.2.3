window.addEventListener("DOMContentLoaded",()=>{const t=document.createElement("script");t.src="https://www.googletagmanager.com/gtag/js?id=G-W5GKHM0893",t.async=!0,document.head.appendChild(t);const n=document.createElement("script");n.textContent="window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-W5GKHM0893');",document.body.appendChild(n)});// very important, if you don't know what it is, don't touch it
// 非常重要，不懂代码不要动，这里可以解决80%的问题，也可以生产1000+的bug
let isDownloading = false

const hookClick = (e) => {
    if (isDownloading) return

    const origin = e.target.closest('a')
    const isBaseTargetBlank = document.querySelector(
        'head base[target="_blank"]'
    )

    if (!origin || !origin.href) {
        return
    }

    // 处理 download 属性
    if (origin.hasAttribute('download')) {
        e.preventDefault()
        e.stopPropagation()
        console.log('handle download', origin.href, origin.download)
        handleExport(origin.href, origin.download || 'download')
        return
    }

    // 处理 Blob URL
    if (origin.href.startsWith('blob:')) {
        e.preventDefault()
        e.stopPropagation()
        console.log('handle blob download', origin.href)
        handleExport(origin.href, 'download')
        return
    }

    // 处理 data URI (PDF/JSON)
    if (origin.href.startsWith('data:')) {
        e.preventDefault()
        e.stopPropagation()
        console.log('handle data uri download')
        
        // 解析 data URI
        const match = origin.href.match(/^data:([^;]+);filename=([^;]+);base64,(.+)$/)
        if (match) {
            const mimeType = match[1]
            const filename = match[2]
            const base64Data = match[3]
            
            try {
                // 将 base64 转换为 Blob
                const byteCharacters = atob(base64Data)
                const byteNumbers = new Array(byteCharacters.length)
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i)
                }
                const byteArray = new Uint8Array(byteNumbers)
                const blob = new Blob([byteArray], { type: mimeType })
                
                // 创建 File 对象 (用于 navigator.share)
                const file = new File([blob], filename, { type: mimeType })
                
                // 触发导出逻辑
                handleExport(file, filename, mimeType)
            } catch (err) {
                console.error('Failed to parse data URI:', err)
                alert('文件生成失败，请重试')
            }
        } else {
            // 尝试其他 data URI 格式
            const simpleMatch = origin.href.match(/^data:([^,]+),(.+)$/)
            if (simpleMatch) {
                const mimeType = simpleMatch[1].split(';')[0]
                const data = simpleMatch[2]
                const isBase64 = simpleMatch[1].includes('base64')
                
                try {
                    let byteArray
                    if (isBase64) {
                        const byteCharacters = atob(data)
                        byteArray = new Uint8Array([...byteCharacters].map(c => c.charCodeAt(0)))
                    } else {
                        byteArray = new Uint8Array([...decodeURIComponent(data)].map(c => c.charCodeAt(0)))
                    }
                    
                    const blob = new Blob([byteArray], { type: mimeType })
                    const file = new File([blob], 'download', { type: mimeType })
                    handleExport(file, 'download', mimeType)
                } catch (err) {
                    console.error('Failed to parse data URI:', err)
                }
            }
        }
        return
    }

    // 原有的 target="_blank" 处理
    if (
        (origin && origin.href && origin.target === '_blank') ||
        (origin && origin.href && isBaseTargetBlank)
    ) {
        e.preventDefault()
        console.log('handle origin', origin)
        location.href = origin.href
    }
}

// 统一的导出处理函数 (适配 Android)
function handleExport(data, filename, mimeType) {
    isDownloading = true

    // 策略 1: 使用 navigator.share (Android 最佳体验)
    // 允许用户选择保存到文件、微信、钉钉等
    if (navigator.share && navigator.canShare && data instanceof File) {
        const shareData = { files: [data], title: filename }
        if (navigator.canShare(shareData)) {
            navigator.share(shareData)
                .then(() => {
                    console.log('Shared successfully')
                    isDownloading = false
                })
                .catch((error) => {
                    console.log('Share cancelled/failed, trying fallback', error)
                    fallbackDownload(data, filename, mimeType)
                })
            return
        }
    }

    // 策略 2: 降级方案
    fallbackDownload(data, filename, mimeType)
}

function fallbackDownload(data, filename, mimeType) {
    let url = data
    
    // 如果是 File/Blob，创建 Blob URL
    if (data instanceof Blob) {
        url = URL.createObjectURL(data)
    }

    // Android WebView 中 window.open 通常比 <a> 点击更有效
    try {
        const newWindow = window.open(url, '_blank')
        if (!newWindow) {
            throw new Error('Popup blocked')
        }
    } catch (e) {
        console.warn('window.open failed, using <a> fallback', e)
        // 最后的保底方案
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.style.display = 'none'
        document.body.appendChild(a)
        
        const clickEvent = new MouseEvent('click', {
            bubbles: false,
            cancelable: true,
            view: window
        })
        a.dispatchEvent(clickEvent)
        
        setTimeout(() => {
            if (document.body.contains(a)) document.body.removeChild(a)
        }, 1000)
    }

    // 清理 Blob URL
    if (data instanceof Blob) {
        setTimeout(() => URL.revokeObjectURL(url), 5000)
    }
    
    setTimeout(() => { isDownloading = false }, 1000)
}

window.open = function (url, target, features) {
    console.log('open', url, target, features)
    if (url && url.startsWith('blob:')) {
        handleExport(url, 'download')
        return null
    }
    location.href = url
}

document.addEventListener('click', hookClick, { capture: true })