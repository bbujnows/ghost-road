import { FETCH } from './balance'
import type { EnemyKind, Group } from './balance'
import type { NightSpec } from './nights'

/**
 * The Long Road — endless (design doc §8, consult §7.3).
 *
 * Nights 8 onward, procedurally escalating, played for a high-water mark. **The road
 * itself is generated per run** (see `roadgen.ts`), which is the consult's Rogue Tower
 * lesson: a new map is worth more to "one more run" than a new number.
 *
 * The escalation formulas are the doc's, transcribed, not invented:
 *
 * | Knob | Formula |
 * | --- | --- |
 * | Fog | `min(0.95, 0.50 + 0.05 × (n − 7))` — maxes around Night 16 |
 * | Enemy HP | `× (1 + 0.12 × (n − 7))` — uncapped, the primary wall |
 * | Enemy speed | `× min(1.5, 1 + 0.03 × (n − 7))` — capped, so it never becomes reflexes |
 * | Waves | 3, → 4 at Night 12, → 5 at Night 20 |
 * | Starting oil | `120 + 10 × floor((n − 7) / 5)` — grows far slower than HP |
 *
 * **Bosses return every third night from 10**, drawn from a run-seeded order rather than
 * randomly per night, so a run has a recognisable shape you can plan against.
 *
 * **The draft is not built** (consult §7.3 proposes one toy or ward branch every three
 * nights). Toys are already a free per-night choice and every ward branch is already open
 * because stash does not exist, so a draft today would offer the player things they
 * already have. It lands with stash.
 */

export function fogFor(n: number): number {
  return Math.min(0.95, 0.5 + 0.05 * (n - 7))
}

export function hpScaleFor(n: number): number {
  return 1 + 0.12 * (n - 7)
}

export function speedScaleFor(n: number): number {
  return Math.min(1.5, 1 + 0.03 * (n - 7))
}

/**
 * **Capped at 4, deviating from the doc's "5 at Night 20" — measured.**
 *
 * §11's five-minute session is a hard constraint; it is the reason this game exists in
 * the shape it does. At five waves a Long Road night measured **6:41**, and the doc's own
 * §8 note concedes five waves "still lands near 6 minutes". Four waves with compressed
 * gaps lands under five, and HP is already the primary wall by the doc's own design — so
 * the wall does not need the extra wave to keep rising.
 */
export function wavesFor(n: number): number {
  if (n >= 12) return 4
  return 3
}

export function oilFor(n: number): number {
  return 120 + 10 * Math.floor((n - 7) / 5)
}

/** Wind arrives once fog is doing real work, and stays. */
export function windFor(n: number): number {
  return n >= 11 ? Math.max(16, 26 - Math.floor((n - 11) / 4) * 2) : 0
}

// §6: the Drownd Girl joins here rather than in the campaign — the seven nights already
// have their three boss slots filled, and the endless pool is where §6 said the blocked
// bosses belong once their systems landed. Hers landed 2026-07-30.
const BOSSES: EnemyKind[] = ['bellWitch', 'greenbrier', 'drover', 'drownd']
const SUPPORT: EnemyKind[] = ['crawler', 'unseen', 'boneDog', 'tallowMan']

export function isBossNight(n: number): boolean {
  return n >= 10 && (n - 10) % 3 === 0
}

function g(kind: EnemyKind, count: number, gap: number, start = 0): Group {
  return { kind, count, gap, start }
}

/**
 * A night on the Long Road.
 *
 * `rng` must be the run's seeded generator, advanced night by night — that is what makes
 * a run reproducible and gives it a shape rather than a sequence of unrelated nights.
 */
export function longRoadNight(n: number, rng: () => number): NightSpec {
  const waveCount = wavesFor(n)
  const step = n - 7

  // Counts grow slowly. HP is the wall (doc §8); throwing bodies at the player as well
  // would push nights past the session budget long before it made them harder.
  const walkers = 7 + Math.min(4, Math.floor(step / 4))
  const support = 4 + Math.min(4, Math.floor(step / 4))

  // Gaps compress with the speed scaling. Without this a wave gets *longer* as the night
  // gets harder — the same number of spawns at the same spacing, chasing faster enemies
  // down a road they clear sooner. Later nights should feel denser, not slower.
  const pace = speedScaleFor(n)

  const a = SUPPORT[Math.floor(rng() * SUPPORT.length)]
  const b = SUPPORT[Math.floor(rng() * SUPPORT.length)]

  const waves: { groups: Group[] }[] = []
  for (let w = 0; w < waveCount; w++) {
    const last = w === waveCount - 1
    const groups: Group[] = [
      g('walker', walkers + w, (3.8 - w * 0.2) / pace),
      g(a, support + w, 1.5 / pace, 8),
    ]
    if (w > 0) groups.push(g(b, support, 2.2 / pace, 13))
    if (last && n >= 13) groups.push(g('tallowMan', 1 + Math.floor(step / 8), 8, 20))
    if (last && isBossNight(n)) {
      const boss = BOSSES[Math.floor(rng() * BOSSES.length)]
      // §6: the Fetch is *three* copies of Kara, not one. It is the only boss that is a
      // crowd, because the crowd is the mechanic.
      groups.push(g(boss, boss === 'fetch' ? FETCH.count : 1, 2.5, 24))
    }
    waves.push({ groups })
  }

  return {
    n,
    name: `Night ${n}`,
    lede: `The road keeps going. Night ${n}.`,
    teaches: isBossNight(n) ? 'Something is leading them tonight.' : '',
    startingOil: oilFor(n),
    fog: fogFor(n),
    wind: windFor(n),
    waves,
  }
}

// ─── The high-water mark ────────────────────────────────────────────────────

export interface LongRoadRecord {
  /** Furthest night reached, ever. */
  best: number
}

const KEY = 'ghost-road/longroad'

export function loadBest(): number {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return 0
    const parsed = JSON.parse(raw) as Partial<LongRoadRecord>
    return Number.isFinite(parsed.best) ? Math.max(0, Math.floor(parsed.best as number)) : 0
  } catch {
    return 0
  }
}

export function saveBest(night: number) {
  try {
    if (night <= loadBest()) return
    localStorage.setItem(KEY, JSON.stringify({ best: night }))
  } catch {
    // Losing a high score is survivable. Throwing is not.
  }
}
