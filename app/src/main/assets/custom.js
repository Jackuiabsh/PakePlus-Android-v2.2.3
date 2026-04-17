window.addEventListener("DOMContentLoaded",()=>{const t=document.createElement("script");t.src="https://www.googletagmanager.com/gtag/js?id=G-W5GKHM0893",t.async=!0,document.head.appendChild(t);const n=document.createElement("script");n.textContent="window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-W5GKHM0893');",document.body.appendChild(n)});// PakePlus Android WebView Hook - 适配本项目
// 非常重要，不懂代码不要动

let isDownloading = false

const hookClick = (e) => {
    if (isDownloading) return

    const origin = e.target.closest('a')
    const isBaseTargetBlank = document.querySelector(
        'head base[target="_blank"]'
    )

    // 检查 origin 和 href 是否有效
    if (!origin || !origin.href || origin.href === 'null' || origin.href === '') {
        return
    }

    // ====== 白名单：不处理的链接 ======
    // 1. Vue Router 路由链接 (javascript:)
    if (origin.href.startsWith('javascript:')) {
        return
    }
    
    // 2. 项目内部路由 (以 / 开头或相对路径)
    if (origin.getAttribute('href')?.startsWith('/') || 
        (!origin.href.startsWith('http') && !origin.href.startsWith('blob:') && !origin.href.startsWith('data:'))) {
        return
    }
    
    // 3. 带有 no-hook 属性的链接
    if (origin.hasAttribute('data-no-hook')) {
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
                const byteCharacters = atob(base64Data)
                const byteNumbers = new Array(byteCharacters.length)
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i)
                }
                const byteArray = new Uint8Array(byteNumbers)
                const blob = new Blob([byteArray], { type: mimeType })
                const blobUrl = URL.createObjectURL(blob)
                triggerViaIframe(blobUrl, filename)
                setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
            } catch (err) {
                console.error('Failed to parse data URI:', err)
                // 使用 toast 替代 alert
                if (window.showToast) {
                    window.showToast('文件生成失败，请重试')
                }
            }
        } else {
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

    // 处理外部链接 target="_blank"
    if (
        (origin && origin.href && origin.target === '_blank') ||
        (origin && origin.href && isBaseTargetBlank)
    ) {
        try {
            // 检查是否是项目内部链接
            const currentHost = window.location.host
            const linkHost = new URL(origin.href).host
            
            // 同域名下的链接不拦截，让 Vue Router 处理
            if (currentHost === linkHost) {
                return
            }
            
            e.preventDefault()
            console.log('handle external link', origin.href)
            location.href = origin.href
        } catch (err) {
            // URL 解析失败，可能是无效链接，不处理
            console.log('not handle origin', origin.href)
        }
    }
}

// 使用隐藏 iframe 触发下载
function triggerViaIframe(url, filename) {
    isDownloading = true
    
    const oldIframe = document.getElementById('download-iframe')
    if (oldIframe) oldIframe.remove()
    
    const iframe = document.createElement('iframe')
    iframe.id = 'download-iframe'
    iframe.style.display = 'none'
    iframe.src = url
    document.body.appendChild(iframe)
    
    setTimeout(() => {
        if (iframe.parentNode) iframe.remove()
        isDownloading = false
    }, 3000)
}

// 统一入口
function triggerAndroidDownload(url, filename) {
    isDownloading = true
    triggerViaIframe(url, filename)
    setTimeout(() => { isDownloading = false }, 3000)
}

// 重写 window.open
window.open = function (url, target, features) {
    console.log('window.open', url, target, features)
    
    // 不处理空链接
    if (!url) return null
    
    // 处理 blob/data URL 下载
    if (url.startsWith('blob:') || url.startsWith('data:')) {
        triggerAndroidDownload(url, 'download')
        return null
    }
    
    // 处理外部链接
    if (url.startsWith('http')) {
        const currentHost = window.location.host
        const linkHost = new URL(url).host
        
        if (currentHost !== linkHost) {
            location.href = url
            return null
        }
    }
    
    // 其他情况使用默认行为
    return null
}

// 导出供项目使用
window.pakeDownload = {
    download: triggerAndroidDownload,
    downloadDataUri: (dataUri, filename) => {
        const a = document.createElement('a')
        a.href = dataUri
        a.download = filename
        a.setAttribute('data-no-hook', 'true')
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
    }
}

// 延迟绑定，确保 Vue 先初始化
document.addEventListener('DOMContentLoaded', () => {
    // 使用 setTimeout 确保在 Vue 之后绑定
    setTimeout(() => {
        document.addEventListener('click', hookClick, { capture: true })
        console.log('Pake hook initialized')
    }, 100)
})
