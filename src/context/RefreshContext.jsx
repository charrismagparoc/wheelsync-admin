import { createContext, useCallback, useContext, useState } from 'react'

const RefreshContext = createContext({ refreshKey: 0, refresh: () => {} })

// The topbar Refresh button bumps the key; App remounts the current page so it loads fresh data
// without a full browser reload (which loses the page and, on static hosting, can 404).
export function RefreshProvider({ children }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((key) => key + 1), [])
  return <RefreshContext.Provider value={{ refreshKey, refresh }}>{children}</RefreshContext.Provider>
}

export const useRefresh = () => useContext(RefreshContext)
