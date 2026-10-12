import { Search, X } from 'lucide-react'

export default function SearchBar({ value, onChange, placeholder = 'Search', className = '' }) {
  return (
    <div className={`relative flex-1 min-w-56 ${className}`}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full py-2 pl-9 pr-9 text-sm"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1" style={{ color: 'var(--text-faint)' }}>
          <X size={14} />
        </button>
      )}
    </div>
  )
}
