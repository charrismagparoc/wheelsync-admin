import { useState } from 'react'

// Column chart of rentals per month. Bar heights are exact against a labelled 0..max axis;
// months that have not happened yet are shown as empty slots, not as zero bars.
function niceAxis(max) {
  if (max <= 0) return { top: 4, ticks: [0, 1, 2, 3, 4] }
  const rough = max / 4
  const power = 10 ** Math.floor(Math.log10(rough))
  // Rentals are whole numbers, so the scale never steps by less than 1 (no "0.5 rentals").
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * power).find((candidate) => candidate >= rough))
  const top = Math.ceil(max / step) * step
  const ticks = []
  for (let value = 0; value <= top; value += step) ticks.push(value)
  return { top, ticks }
}

export default function MonthlyRentalsChart({ months, year }) {
  const [active, setActive] = useState(null)
  const now = new Date()
  const currentMonth = year === now.getFullYear() ? now.getMonth() : year < now.getFullYear() ? 11 : -1
  const max = Math.max(0, ...months.map((month) => month.count))
  const { top, ticks } = niceAxis(max)
  const total = months.reduce((sum, month) => sum + month.count, 0)

  return (
    // relative: keeps the hidden screen-reader table inside the chart instead of stretching the page.
    <div className="relative">
      <div className="relative flex gap-2" style={{ height: 240 }}>
        {/* y-axis labels */}
        <div className="relative w-8 shrink-0 text-right text-xs tabular-nums" style={{ color: 'var(--text-faint)' }} aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} className="absolute right-0" style={{ bottom: `${(tick / top) * 100}%`, transform: 'translateY(50%)' }}>{tick}</span>
          ))}
        </div>

        <div className="relative flex-1">
          {/* recessive gridlines */}
          {ticks.map((tick) => (
            <div key={tick} className="absolute inset-x-0" aria-hidden="true" style={{ bottom: `${(tick / top) * 100}%`, borderTop: tick === 0 ? '1px solid var(--text-faint)' : '1px dashed var(--border-soft)' }} />
          ))}

          <div className="absolute inset-0 grid grid-cols-12 gap-0.5 sm:gap-1.5">
            {months.map((month, index) => {
              const future = index > currentMonth
              const isCurrent = index === currentMonth
              const height = (month.count / top) * 100
              const label = `${month.month} ${year}: ${future ? 'not yet' : `${month.count} rental${month.count === 1 ? '' : 's'}`}`
              return (
                <button
                  key={month.month}
                  type="button"
                  className="relative h-full flex items-end justify-center focus:outline-none"
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  aria-label={label}
                >
                  {active === index && (
                    <span role="tooltip" className="absolute z-10 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs shadow-lg card" style={{ bottom: `calc(${future ? 0 : height}% + 8px)` }}>
                      <strong>{month.month} {year}</strong><br />
                      {future ? 'Not yet' : `${month.count} rental${month.count === 1 ? '' : 's'}`}
                    </span>
                  )}
                  {future ? (
                    <span className="w-full max-w-10 h-full rounded-t" style={{ background: 'repeating-linear-gradient(135deg, transparent 0 6px, var(--border-soft) 6px 7px)' }} />
                  ) : (
                    <span
                      className="w-full max-w-10 rounded-t transition-opacity"
                      style={{
                        height: `${height}%`,
                        minHeight: month.count ? 3 : 0,
                        background: 'var(--nebula-1)',
                        // The current month is marked by an outline (and a bold label), not a second color.
                        outline: isCurrent && month.count ? '2px solid var(--text-primary)' : 'none',
                        outlineOffset: 2,
                        opacity: active === null || active === index ? 1 : 0.55,
                      }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* month labels under the columns */}
      <div className="flex gap-2 mt-2">
        <div className="w-8 shrink-0" />
        <div className="flex-1 grid grid-cols-12 gap-0.5 sm:gap-1.5 text-center text-[11px] sm:text-xs" aria-hidden="true">
          {months.map((month, index) => (
            <span key={month.month} style={{ color: index === currentMonth ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: index === currentMonth ? 600 : 400 }}>{month.month}</span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'var(--nebula-1)' }} /> Rentals</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'var(--nebula-1)', outline: '2px solid var(--text-primary)', outlineOffset: 1 }} /> This month (bold label)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'repeating-linear-gradient(135deg, transparent 0 3px, var(--text-faint) 3px 4px)' }} /> Not yet</span>
        <span className="ml-auto">Total this year: <strong style={{ color: 'var(--text-primary)' }}>{total}</strong></span>
      </div>

      {/* the same numbers as a table, for screen readers */}
      <table className="sr-only">
        <caption>Rentals per month in {year}</caption>
        <thead><tr><th>Month</th><th>Rentals</th></tr></thead>
        <tbody>{months.map((month) => <tr key={month.month}><td>{month.month}</td><td>{month.count}</td></tr>)}</tbody>
      </table>
    </div>
  )
}
