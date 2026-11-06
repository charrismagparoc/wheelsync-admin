import { useEffect, useState } from 'react'
import { FileWarning, ImageOff, RefreshCw } from 'lucide-react'

// Uploaded documents and photos come from links on the API. When a file is missing on the server or its link has
// expired, these show a clear message instead of the server's raw JSON error or a broken image.

const BOX = 'flex flex-col items-center justify-center gap-2 rounded-lg px-4 text-center text-sm'

// A photo or PDF document. Loaded first so a failed request can be shown properly.
// onStatus (optional) hears 'ready', 'missing' (not on the server) or 'error' once the file has loaded or failed.
export default function FilePreview({ url, title, missingText = 'This file is no longer on the server.', className = 'h-56', onStatus }) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ key: null })
  const key = `${url}#${attempt}`
  const status = result.key !== key ? null : result.error === undefined ? 'ready' : result.error === 404 ? 'missing' : 'error'

  useEffect(() => {
    if (status) onStatus?.(status)
  }, [status, onStatus])

  useEffect(() => {
    let active = true
    let objectUrl = null
    fetch(url)
      .then(async (response) => {
        if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status })
        const blob = await response.blob()
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setResult({ key, src: objectUrl, pdf: blob.type === 'application/pdf' })
      })
      .catch((error) => {
        if (active) setResult({ key, error: error.status ?? 0 }) // 0: offline or the server did not answer
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url, key])

  if (result.key !== key) {
    return <div className={`${BOX} ${className}`} style={{ background: 'var(--bg-surface-2)', color: 'var(--text-muted)' }}>Loading…</div>
  }
  if (result.error !== undefined) {
    const message = result.error === 404 ? missingText
      : result.error === 403 ? 'This link has expired. Close this window and open it again.'
        : 'Could not load this file. Check your connection and try again.'
    return (
      <div role="alert" className={`${BOX} ${className}`} style={{ background: 'rgba(251,191,36,0.10)', color: 'var(--warning)' }}>
        <FileWarning size={22} />
        <p className="font-medium">{message}</p>
        {result.error !== 404 && result.error !== 403 && (
          <button type="button" onClick={() => setAttempt((count) => count + 1)} className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1 text-xs">
            <RefreshCw size={12} /> Try again
          </button>
        )}
      </div>
    )
  }
  return result.pdf
    ? <iframe title={title} src={result.src} className={`w-full rounded-lg ${className}`} />
    : <img src={result.src} alt={title} className={`w-full rounded-lg object-contain ${className}`} style={{ background: 'var(--bg-surface-2)' }} />
}

// An <img> that turns into a "photo missing" placeholder when the file cannot be loaded.
// fallbackText is shown as text on larger placeholders (showText) and as a tooltip on small ones.
export function SafeImage({ src, alt = '', className = '', fallbackClassName, fallbackText = 'Photo missing', showText = false, ...props }) {
  const [failedSrc, setFailedSrc] = useState(null)
  if (!src || failedSrc === src) {
    return (
      <div
        role="img"
        aria-label={fallbackText}
        title={fallbackText}
        className={`flex flex-col items-center justify-center gap-1 text-center text-xs ${fallbackClassName ?? className}`}
        style={{ background: 'var(--bg-surface-2)', color: 'var(--text-faint)' }}
      >
        <ImageOff size={showText ? 22 : 14} />
        {showText && <span className="px-2">{fallbackText}</span>}
      </div>
    )
  }
  return <img src={src} alt={alt} className={className} onError={() => setFailedSrc(src)} {...props} />
}
