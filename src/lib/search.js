// True when every word typed in the search box appears somewhere in the given values.
export function matchesSearch(query, ...values) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const text = values.filter((value) => value != null).join(' ').toLowerCase()
  return words.every((word) => text.includes(word))
}
