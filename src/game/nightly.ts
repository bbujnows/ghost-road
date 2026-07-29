import type { EnemyKind, Group } from './balance'
import type { NightSpec } from './nights'
import { TOYS } from './toys'
import type { ToyId } from './toys'

/**
 * The Nightly Road (consult §7.2). One seeded night per calendar day, the same for
 * everyone, one attempt, a local streak.
 *
 * **The seed is the date, so the night is not random — it is fixed.** That is the whole
 * point: a daily challenge you can compare notes on. Everything below is derived from
 * `dateKey()` and nothing reads `Math.random()`.
 *
 * The design problem a daily has that a campaign does not: **it must be fair on every
 * roll.** A campaign night can be hard because it is Night 7. A daily that happens to
 * roll heavy fog, wind, and a boss is not "hard", it is a day the player lost to the
 * generator. So difficulty is scored as it is built and **starting oil is set to pay for
 * it** — a bad roll hands you the oil to answer it.
 */

/** Local date, not UTC: the player's day is the one they are living in. */
export function dateKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32 — small, fast, and good enough that two adjacent dates look unrelated. */
function rngFrom(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface NightlyNight extends NightSpec {
  key: string
  /** The one toy offered. Everyone gets the same one — it is part of the puzzle. */
  toy: ToyId
  /** Shown on the briefing, so the player knows what they drew. */
  modifiers: string[]
}

/** Roughly how much trouble each thing is, for the oil compensation below. */
const THREAT: Record<EnemyKind, number> = {
  walker: 1,
  crawler: 1.1,
  unseen: 1.6,
  boneDog: 2,
  tallowMan: 3,
  bellWitch: 14,
  greenbrier: 14,
  drover: 20,
}

const SUPPORT: EnemyKind[] = ['crawler', 'unseen', 'boneDog', 'tallowMan']
const BOSSES: EnemyKind[] = ['bellWitch', 'greenbrier', 'drover']
const FOGS = [0, 0, 0.15, 0.3, 0.45, 0.6]

const BOSS_NAME: Partial<Record<EnemyKind, string>> = {
  bellWitch: 'the Bell Witch',
  greenbrier: 'the Greenbrier Ghost',
  drover: 'the Drover',
}

const KIND_NAME: Partial<Record<EnemyKind, string>> = {
  crawler: 'Crawlers',
  unseen: 'The Unseen',
  boneDog: 'Bone Dogs',
  tallowMan: 'Tallow Men',
}

function pick<T>(rng: () => number, from: T[]): T {
  return from[Math.floor(rng() * from.length)]
}

/**
 * Tonight's road. Deterministic in `key` — call it twice and get the same night.
 */
export function nightlyFor(key = dateKey()): NightlyNight {
  const rng = rngFrom(hashSeed(`ghost-road/${key}`))

  // Two support types, never the same one twice. Walkers are always the bed of it.
  const pool = [...SUPPORT]
  const a = pool.splice(Math.floor(rng() * pool.length), 1)[0]
  const b = pool.splice(Math.floor(rng() * pool.length), 1)[0]

  const boss = rng() < 0.34 ? pick(rng, BOSSES) : null
  let fog = pick(rng, FOGS)
  const wind = rng() < 0.3 ? 18 + Math.floor(rng() * 4) * 3 : 0
  const toy = pick(rng, TOYS).id

  // **At most two heavy modifiers.** Difficulty from stacked modifiers is super-linear
  // while the oil compensation below is linear, so a boss behind thick fog on a windy
  // night is not "a hard day", it is a day the generator won. Fog is the one that gives
  // way: wind and the boss are both things the player can answer with a decision, and
  // fog is the one that just takes reach away.
  if (boss && wind && fog >= 0.45) fog = 0.3

  // Wave shape is fixed on purpose. The draw decides *what* comes, never how much —
  // a daily whose length swings by two minutes is not a ritual, it is a coin flip.
  const waves: { groups: Group[] }[] = [
    { groups: [g('walker', 7, 3.8), g(a, 4, 1.6, 14)] },
    { groups: [g('walker', 7, 3.6), g(a, 5, 1.4, 10), g(b, 4, 2.4, 20)] },
    {
      groups: [
        g('walker', 8, 3.4),
        g(a, 5, 1.3, 8),
        g(b, 5, 2.2, 16),
        ...(boss ? [g(boss, 1, 0, 30)] : [g(a, 4, 1.5, 30)]),
      ],
    },
  ]

  // Score what was drawn, then pay for it. A heavy night starts you rich enough to
  // answer it; the difficulty stays in the play, not in the roll.
  let threat = 0
  for (const wave of waves) {
    for (const group of wave.groups) threat += THREAT[group.kind] * group.count
  }
  const load = threat + fog * 70 + (wind ? 28 : 0)
  const startingOil = Math.round(60 + load * 0.62)

  const modifiers: string[] = []
  if (fog >= 0.45) modifiers.push('thick fog')
  else if (fog > 0) modifiers.push('fog')
  if (wind) modifiers.push('wind')
  if (boss) modifiers.push(BOSS_NAME[boss]!)

  return {
    key,
    n: 0,
    name: 'The Nightly Road',
    lede: `Tonight's road, the same one everybody walks. ${key}.`,
    teaches: [KIND_NAME[a], KIND_NAME[b], ...modifiers].filter(Boolean).join(' · '),
    startingOil,
    fog,
    wind,
    waves,
    toy,
    modifiers,
  }
}

function g(kind: EnemyKind, count: number, gap: number, start = 0): Group {
  return { kind, count, gap, start }
}

// ─── The streak ─────────────────────────────────────────────────────────────

export interface NightlyRecord {
  /** The last date attempted, so a reload cannot buy a second run. */
  attempted: string | null
  /** The last date actually held. */
  held: string | null
  streak: number
  best: number
}

const EMPTY: NightlyRecord = { attempted: null, held: null, streak: 0, best: 0 }
const KEY = 'ghost-road/nightly'

export function loadRecord(): NightlyRecord {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw) as Partial<NightlyRecord>
    return {
      attempted: typeof parsed.attempted === 'string' ? parsed.attempted : null,
      held: typeof parsed.held === 'string' ? parsed.held : null,
      streak: Number.isFinite(parsed.streak) ? Math.max(0, Math.floor(parsed.streak as number)) : 0,
      best: Number.isFinite(parsed.best) ? Math.max(0, Math.floor(parsed.best as number)) : 0,
    }
  } catch {
    return { ...EMPTY }
  }
}

function saveRecord(r: NightlyRecord) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r))
  } catch {
    // Losing a streak to private browsing is survivable. Throwing is not.
  }
}

/** Yesterday's key, for deciding whether a streak continues or restarts. */
function previousKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() - 1)
  return dateKey(date)
}

export function alreadyAttempted(key = dateKey()): boolean {
  return loadRecord().attempted === key
}

/**
 * Called when the night *starts*, not when it ends. One attempt has to mean one
 * attempt: marking it at the end would let a reload mid-run buy another try, and a
 * streak you can reload your way out of is not worth counting.
 */
export function markAttempted(key = dateKey()): NightlyRecord {
  const r = loadRecord()
  r.attempted = key
  saveRecord(r)
  return r
}

/**
 * A win. The streak continues if yesterday was also held, and otherwise starts again at
 * one — an unresolved attempt (a crashed tab, a closed laptop) simply does not advance
 * it rather than breaking it, because losing a streak to a browser is not a game
 * outcome.
 */
export function recordHeld(key = dateKey()): NightlyRecord {
  const r = loadRecord()
  if (r.held === key) return r

  r.streak = r.held === previousKey(key) ? r.streak + 1 : 1
  r.held = key
  r.best = Math.max(r.best, r.streak)
  saveRecord(r)
  return r
}

/** A loss ends it. This is the only thing that resets a streak to zero. */
export function recordLost(key = dateKey()): NightlyRecord {
  const r = loadRecord()
  r.attempted = key
  r.streak = 0
  saveRecord(r)
  return r
}
