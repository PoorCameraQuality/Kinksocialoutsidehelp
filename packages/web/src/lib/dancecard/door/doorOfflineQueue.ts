const DB_NAME = 'dancecard-door'
const STORE = 'checkInQueue'
const DB_VERSION = 1

export type DoorQueuedCheckIn = {
  id: string
  registrantId: string
  earlyCheckInOverride: boolean
  clientTimestamp: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
  })
}

export async function enqueueDoorCheckIn(item: Omit<DoorQueuedCheckIn, 'id'>): Promise<DoorQueuedCheckIn> {
  const db = await openDb()
  const entry: DoorQueuedCheckIn = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ...item,
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return entry
}

export async function listDoorQueue(): Promise<DoorQueuedCheckIn[]> {
  const db = await openDb()
  const items = await new Promise<DoorQueuedCheckIn[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result as DoorQueuedCheckIn[]) ?? [])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return items.sort((a, b) => a.clientTimestamp.localeCompare(b.clientTimestamp))
}

export async function removeDoorQueueItem(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function clearDoorQueue(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
