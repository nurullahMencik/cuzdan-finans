/// <reference lib="webworker" />
import { writeSampleData } from './seedData'

/**
 * Generating ~2 000 transactions and writing them to IndexedDB takes a few
 * hundred milliseconds on a slow phone; doing it here keeps the UI thread free.
 * The page passes its clock so tests with a fixed date stay deterministic.
 */
self.addEventListener('message', (event: MessageEvent<{ now: number }>) => {
  writeSampleData(new Date(event.data.now)).then(
    () => self.postMessage({ ok: true }),
    (error: unknown) => self.postMessage({ ok: false, error: String(error) }),
  )
})
