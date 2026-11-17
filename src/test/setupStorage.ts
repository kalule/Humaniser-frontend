// Node 25 defines a global `localStorage` that has no methods unless Node is started with
// --localstorage-file, and it shadows jsdom's working one. Tests (and zustand's persist middleware)
// then fail with "storage.setItem is not a function". Install an in-memory Storage only when the
// global one is unusable, so a working browser-like environment is left alone.

class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  get length() { return this.map.size }
  clear() { this.map.clear() }
  getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null }
  key(index: number) { return [...this.map.keys()][index] ?? null }
  removeItem(key: string) { this.map.delete(key) }
  setItem(key: string, value: string) { this.map.set(key, String(value)) }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  let usable = false
  try { usable = typeof globalThis[name]?.setItem === 'function' } catch { usable = false }
  if (!usable) Object.defineProperty(globalThis, name, { value: new MemoryStorage(), configurable: true, writable: true })
}
