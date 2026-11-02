/** Seeded PRNG (mulberry32): the same seed always yields the same sequence. */
export class Random {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  chance(probability: number): boolean {
    return this.next() < probability
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  /** Log-uniform between min and max: small amounts are more common. */
  amount(min: number, max: number): number {
    const v = Math.exp(Math.log(min) + this.next() * (Math.log(max) - Math.log(min)))
    return Math.round(v * 100) / 100
  }

  pick<T>(items: readonly T[]): T {
    const item = items[Math.floor(this.next() * items.length)]
    if (item === undefined) throw new Error('pick() on empty list')
    return item
  }

  /** Multiplies by a random factor in [1 - spread, 1 + spread]. */
  jitter(value: number, spread: number): number {
    return Math.round(value * (1 + (this.next() * 2 - 1) * spread) * 100) / 100
  }
}
