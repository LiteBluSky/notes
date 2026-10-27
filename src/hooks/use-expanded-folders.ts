import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'notes:expanded-folders'

// Remembers which folders are open across reloads. Starts empty on the server
// and on first client render, then restores from localStorage after hydration.
export function useExpandedFolders() {
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set())

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setExpanded(new Set(JSON.parse(stored) as Array<number>))
    } catch {
      // Unavailable or corrupt storage — start collapsed.
    }
  }, [])

  const update = useCallback(
    (change: (prev: ReadonlySet<number>) => ReadonlySet<number>) => {
      setExpanded((prev) => {
        const next = change(prev)
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
        } catch {
          // Ignore — expansion just won't persist.
        }
        return next
      })
    },
    [],
  )

  const setOpen = useCallback(
    (id: number, open: boolean) =>
      update((prev) => {
        const next = new Set(prev)
        if (open) next.add(id)
        else next.delete(id)
        return next
      }),
    [update],
  )

  const collapseAll = useCallback(() => update(() => new Set()), [update])

  return { expanded, setOpen, collapseAll }
}
