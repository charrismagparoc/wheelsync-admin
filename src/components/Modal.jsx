import { useEffect, useId } from 'react'
import { X } from 'lucide-react'

// Pop-up card used for every "Add / Edit" form. Closes on Esc, the X button, or a click outside.
// Always centred and never taller than the screen: the title stays on top, the form scrolls inside,
// and a form's button row (className "modal-actions") stays pinned at the bottom.
export default function Modal({ title, description, onClose, children, size = 'max-w-2xl' }) {
  const titleId = useId()

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden' // the page behind doesn't scroll while the pop-up is open
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <section
        role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={`card flex w-full ${size} max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden shadow-2xl sm:max-h-[calc(100dvh-3rem)]`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4" style={{ borderColor: 'var(--border-soft)' }}>
          <div>
            <h2 id={titleId} className="font-display text-lg font-semibold">{title}</h2>
            {description && <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn-ghost p-2" aria-label="Close"><X size={16} /></button>
        </header>
        <div className="modal-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4">
          {children}
        </div>
      </section>
    </div>
  )
}
