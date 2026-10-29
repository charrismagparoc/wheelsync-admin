import { useState } from 'react'

// A dashboard number. With `options` ([{ key, label, value, hint }]) it shows small toggle buttons
// (e.g. Today / Week / Month / Total) and the value of the selected one; `defaultOption` picks the first shown.
export default function StatCard({ label, value, icon: Icon, options, defaultOption, hint }) {
  const [chosen, setChosen] = useState(null)
  // Until the admin picks one, follow the default (the options may arrive after the first render).
  const selected = chosen ?? defaultOption ?? options?.[0]?.key
  const current = options?.find((option) => option.key === selected)

  return (
    <div className="card p-5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="text-3xl font-display font-semibold mt-1">{current ? current.value : value}</p>
        {(current?.hint ?? hint) && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{current?.hint ?? hint}</p>}
        {options && (
          <div className="mt-3 inline-flex rounded-lg p-0.5" style={{ border: '1px solid var(--border-soft)' }} role="group" aria-label={`${label} period`}>
            {options.map((option) => {
              const active = option.key === selected
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setChosen(option.key)}
                  aria-pressed={active}
                  className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                  style={active ? { background: 'var(--gradient-primary)', color: 'white' } : { color: 'var(--text-muted)' }}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
      {Icon && (
        <div
          className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--gradient-primary)' }}
        >
          <Icon size={20} color="white" />
        </div>
      )}
    </div>
  )
}
