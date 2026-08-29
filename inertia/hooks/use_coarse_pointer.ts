import { useEffect, useState } from 'react'

/**
 * True when the primary input has no hover — a phone or tablet.
 *
 * Any control whose meaning is carried by a hover state owes this a second path;
 * see the reversible badge in `media-status-badge.tsx`.
 */
export function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)')
    const update = () => setCoarse(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return coarse
}
