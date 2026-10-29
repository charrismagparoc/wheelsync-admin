// Shared page layout pieces so every admin page lines up the same way:
//   PageHeader  - title + one-line description on the left, the page's main buttons on the right
//   FilterBar   - one card holding the status tabs (top row) and search / sort / filters (bottom row)
//   Tabs        - pill tabs with an optional count badge
//   Notice      - success / error banner

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold mb-1">{title}</h1>
        {description && <p className="text-sm max-w-3xl" style={{ color: 'var(--text-muted)' }}>{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function FilterBar({ tabs, children }) {
  return (
    <div className="card p-4 mb-5 grid gap-3">
      {tabs}
      {children && (
        <div className="flex flex-wrap items-center gap-3" style={tabs ? { borderTop: '1px solid var(--border-soft)', paddingTop: 12 } : undefined}>
          {children}
        </div>
      )}
    </div>
  )
}

export function Tabs({ options, value, onChange, label = 'Filter' }) {
  return (
    <div className="flex gap-2 flex-wrap" role="tablist" aria-label={label}>
      {options.map(({ key, label: text, count }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
          style={{ background: value === key ? 'var(--gradient-primary)' : 'var(--bg-surface-2)', color: value === key ? 'white' : 'var(--text-muted)' }}
        >
          {text}
          {count > 0 && <span className="rounded-full px-1.5 text-xs font-bold text-white" style={{ background: 'var(--danger)' }}>{count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Notice({ tone = 'error', children }) {
  if (!children) return null
  const success = tone === 'success'
  return (
    <p role={success ? 'status' : 'alert'} className="text-sm px-4 py-3 rounded-xl mb-4" style={{ background: success ? 'rgba(74,222,128,0.12)' : 'rgba(251,113,133,0.12)', color: success ? 'var(--success)' : 'var(--danger)' }}>
      {children}
    </p>
  )
}
