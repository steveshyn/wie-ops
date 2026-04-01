import { useState, useEffect, useCallback } from 'react'

/**
 * Generic data-fetching hook.
 * fn: async function that returns data
 * deps: dependency array for refetch
 * options.immediate: fetch on mount (default true)
 */
export function useAPI(fn, deps = [], options = {}) {
  const { immediate = true } = options
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(immediate)
  const [error,   setError]   = useState(null)

  const execute = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fn()
      setData(result)
    } catch (err) {
      setError(err.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    if (immediate) execute()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execute])

  return { data, loading, error, refetch: execute }
}
