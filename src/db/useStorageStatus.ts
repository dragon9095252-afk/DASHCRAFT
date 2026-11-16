import { useEffect, useState } from 'react'
import { db } from './database'

export type StorageStatus = 'checking' | 'available' | 'unavailable'

let probe: Promise<boolean> | null = null

function probeStorage(): Promise<boolean> {
  probe ??= (async () => {
    if (typeof indexedDB === 'undefined') return false
    try {
      await db.open()
      return true
    } catch {
      return false
    }
  })()
  return probe
}

export function useStorageStatus(): StorageStatus {
  const [status, setStatus] = useState<StorageStatus>('checking')

  useEffect(() => {
    let active = true
    void probeStorage().then((available) => {
      if (active) setStatus(available ? 'available' : 'unavailable')
    })
    return () => {
      active = false
    }
  }, [])

  return status
}
