/**
 * KaryawanKu — offline-tolerant submission queue (ticket #10).
 *
 * Clock in/out submissions are always pushed here first. While the simulated
 * network is offline they stay `pending` (submittedAt === null); the UI shows
 * a "menunggu sinkronisasi" indicator. Toggling back online flushes the queue
 * against the mock endpoint and stamps `submittedAt`. The original action time
 * (`originalTimestamp`) is preserved and is what the UI displays — never the
 * sync time.
 *
 * Backed by localStorage so entries survive a page refresh.
 */

export interface QueuedItem<T> {
  id: string
  item: T
  /** Action time (ISO) — what the UI displays, not the sync time. */
  originalTimestamp: string
  /** Sync time (ISO); `null` while the entry is still waiting to sync. */
  submittedAt: string | null
}

export const ATTENDANCE_QUEUE_KEY = 'kk-attendance-queue'

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `kk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export class OfflineQueue<T> {
  private offline = false
  private listeners = new Set<() => void>()

  constructor(private readonly storageKey: string = ATTENDANCE_QUEUE_KEY) {}

  private read(): QueuedItem<T>[] {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(this.storageKey)
      return raw ? (JSON.parse(raw) as QueuedItem<T>[]) : []
    } catch {
      return []
    }
  }

  private write(items: QueuedItem<T>[]): void {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(this.storageKey, JSON.stringify(items))
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener())
  }

  /** Notify on every queue change; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  isOffline(): boolean {
    return this.offline
  }

  /** Toggle the simulated network state. Coming back online flushes the queue. */
  simulateOffline(value: boolean): void {
    const prev = this.offline
    this.offline = value
    if (!value && prev) this.flush()
    this.emit()
  }

  /**
   * Queue a new item. Offline it stays pending; online it is considered
   * submitted immediately (submittedAt = now).
   */
  enqueue(item: T): QueuedItem<T> {
    const now = new Date().toISOString()
    const entry: QueuedItem<T> = {
      id: createId(),
      item,
      originalTimestamp: now,
      submittedAt: this.offline ? null : now,
    }
    this.write([...this.read(), entry])
    this.emit()
    return entry
  }

  /** Every queued entry, in submission order. */
  getAll(): QueuedItem<T>[] {
    return this.read()
  }

  /** Entries still waiting to sync (submittedAt === null). */
  getPending(): QueuedItem<T>[] {
    return this.read().filter((entry) => entry.submittedAt === null)
  }

  /** Record that an entry has been submitted to the server. */
  markSynced(id: string): void {
    const now = new Date().toISOString()
    this.write(
      this.read().map((entry) =>
        entry.id === id && entry.submittedAt === null ? { ...entry, submittedAt: now } : entry,
      ),
    )
    this.emit()
  }

  /** Simulated sync: "POST" every pending entry to the mock endpoint. */
  flush(): void {
    const pending = this.getPending()
    if (pending.length === 0) return
    pending.forEach((entry) => {
      // Mock endpoint — a real implementation would POST then markSynced.
      console.info(
        `[offline-queue] sinkron ${entry.id} · waktu aksi ${entry.originalTimestamp}`,
      )
      this.markSynced(entry.id)
    })
  }

  size(): number {
    return this.read().length
  }

  pendingSize(): number {
    return this.getPending().length
  }
}