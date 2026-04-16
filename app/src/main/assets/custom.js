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
        triggerAndroidDownload(origin.href, origin.download || 'download')
        return
    }

    // 处理 Blob URL
    if (origin.href.startsWith('blob:')) {
        e.preventDefault()
        e.stopPropagation()
        console.log('handle blob download', origin.href)
        triggerAndroidDownload(origin.href, 'download')
        return
    }

    // 处理 data URI (PDF/JSON)
    if (origin.href.startsWith('data:')) {
        e.preventDefault()
        e.stopPropagation()
        console.log('handle data uri download')
        
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
                
                // 创建 blob URL
                const blobUrl = URL.createObjectURL(blob)
                
                // 使用 iframe 触发下载 (Android WebView 最稳定方式)
                triggerViaIframe(blobUrl, filename)
                
                // 延迟清理
                setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
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
                    const blobUrl = URL.createObjectURL(blob)
                    triggerViaIframe(blobUrl, 'download')
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
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

// 使用隐藏 iframe 触发下载 (Android WebView 最稳定)
function triggerViaIframe(url, filename) {
    isDownloading = true
    
    // 移除旧的 iframe
    const oldIframe = document.getElementById('download-iframe')
    if (oldIframe) oldIframe.remove()
    
    const iframe = document.createElement('iframe')
    iframe.id = 'download-iframe'
    iframe.style.display = 'none'
    iframe.src = url
    document.body.appendChild(iframe)
    
    // 下载触发后清理
    setTimeout(() => {
        if (iframe.parentNode) iframe.remove()
        isDownloading = false
    }, 3000)
}

// 统一入口
function triggerAndroidDownload(url, filename) {
    isDownloading = true
    
    // 如果是 data URI，先转换
    if (url.startsWith('data:')) {
        // 简单处理：直接创建 iframe
        triggerViaIframe(url, filename)
    } else {
        triggerViaIframe(url, filename)
    }
    
    setTimeout(() => { isDownloading = false }, 3000)
}

window.open = function (url, target, features) {
    console.log('open', url, target, features)
    // 不再使用 window.open 处理 blob，防止 about:blank#blocked
    if (url && (url.startsWith('blob:') || url.startsWith('data:'))) {
        triggerAndroidDownload(url, 'download')
        return null
    }
    location.href = url
}

document.addEventListener('click', hookClick, { capture: true })