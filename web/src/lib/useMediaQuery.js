import { useEffect, useState } from 'react'

// Subscribe to a CSS media query. Returns false where matchMedia is unavailable
// (jsdom/SSR), so components default to the wide layout in tests.
export function useMediaQuery(query) {
  const read = () =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false
  const [matches, setMatches] = useState(read)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}
