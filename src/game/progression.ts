import type { ToyId } from './toys'

/**
 * Bond and the ball stash (design doc §3.4, §9).
 *
 * Two currencies, deliberately separated so that in-night tactics and between-night
 * progression never compete for the same pool. **Neither is oil.**
 *
 *  - **Bond** is how well you have looked after her. It buys her, not your defenses, and
 *    it is earned by paying attention at inconvenient moments.
 *  - **Stash** is what she drags back from the dark. It buys equipment.
 *
 * **Bond is held in escrow for the length of a night and only committed when the night is
 * held.** The consult (§6) caught the exploit before it existed: retrying a failed night
 * keeps stash but must not keep bond, or deliberate failure becomes a bond farm — throw
 * the ball four times, walk into the porch, repeat.
 */

export interface Progress {
  /** §3.4. 0–100 across the campaign. */
  bond: number
  stash: number
  /** Toys bought with stash. The Rope is free, so everyone has a loadout on Night 1. */
  toys: ToyId[]
  /** §9. Each purchase is a permanent +25 to every night's starting oil. */
  oilUpgrades: number
  /** §9. Salt lines take 11 crossings instead of 8, for good. */
  saltSack: boolean
  /** §9. Every lantern you place is a little bigger, for good. */
  betterLamp: boolean
  /** §7.2. Chosen once, at the start of a campaign. */
  hard: boolean
  /** §7.2. How many the homestead has taken. Six ends the run. */
  scars: number
  /** §7.2. Persists across all seven nights on Hard. Ignored on Normal. */
  homesteadHp: number
}

/** §9 permanent upgrades, applied wherever the ward is constructed. */
export const SALT_SACK_BONUS = 3
export const BETTER_LAMP_BONUS = 12

/** §7.2 Hard: 10 stash for 15 HP, and it never touches a scar. */
export const REPAIR = { cost: 10, hp: 15 } as const
/** §7.2 Hard: free, between nights. */
export const NIGHTLY_REPAIR = 20

/** §4: one toy is free so the loadout screen is never empty. */
export const STARTING_TOYS: ToyId[] = ['rope']

const EMPTY: Progress = {
  bond: 0,
  stash: 0,
  toys: [...STARTING_TOYS],
  oilUpgrades: 0,
  saltSack: false,
  betterLamp: false,
  hard: false,
  scars: 0,
  homesteadHp: 100,
}
const KEY = 'ghost-road/progress-v2'

// ─── §3.4 Bond tiers ────────────────────────────────────────────────────────

/**
 * Four tiers, each one felt (the 2026-07-27 ruling simplified this from five). Hold moved
 * to the Rope toy, so bond no longer gates an ability the player can name — it gates the
 * *quality* of the dog, which is the right thing for a track called bond.
 */
export const TIERS = [
  { at: 15, name: 'She listens further', effect: 'Ear-Perk 280 → 350px' },
  { at: 35, name: 'She rolls sooner', effect: 'Show Belly 14s → 11s' },
  { at: 60, name: 'She gets up faster', effect: 'Down 25s → 12s' },
  { at: 85, name: 'Lead', effect: 'L on the Seventh Night — the fog lifts where she walks' },
] as const

export function tierOf(bond: number): number {
  let tier = 0
  for (const t of TIERS) if (bond >= t.at) tier += 1
  return tier
}

/** §3.4 gains and losses, in one place so the economy can be read at a glance. */
export const BOND = {
  /** Throwing a dropped ball. ~1 opportunity a night. */
  throwBall: 3,
  /** Ignoring one. She picks it back up, disappointed, after 6s. */
  ignoreBall: -2,
  /** Resting her between nights. Free, and automatic on holding a night. */
  rest: 5,
  /** Feeding her. Costs stash. */
  feed: 4,
  /** Finishing a night without her taking a scratch. */
  unhurt: 8,
  /** She went Down. */
  down: -5,
} as const

// ─── §9 Stash ───────────────────────────────────────────────────────────────

/** §9: she retrieves one item per this many kills. */
export const KILLS_PER_FETCH = 3
/** §9: a 6-second round trip during which she is out of position. */
export const FETCH_SECONDS = 6

export interface StashItem {
  id: string
  name: string
  detail: string
  cost: number
}

/**
 * §9 spending. Only what the built game can honour — the doc's salt capacity and
 * permanent lantern upgrade both name wards that do not exist, and "heal Kara to full"
 * does nothing now that a night starts her whole.
 */
/**
 * §9 spending, repriced 2026-07-29 now that the roster is wide enough to hang purchases on.
 *
 * The two upgrades below are the doc's own, and they were unbuildable until this week —
 * "permanent salt capacity" and "permanent lantern upgrade" both named wards that did not
 * exist. `heal Kara to full` is still cut: a night starts her whole, so it would buy
 * nothing.
 *
 * Measured: **155 of total sinks** (87 in permanent one-offs, 28 to feed her every night, 40
 * in oil drums) against **~97 banked across seven nights with fetching left on the whole
 * time** — so a player who never spares her affords **63%** of it. §9 budgets ~180 against
 * ~90 and wants about half, so this lands where it was aimed.
 *
 * And it lands there **through the toggle rather than through the price list**, which is the
 * better version: every wave she spends defending instead of retrieving pushes that 63%
 * down. The scarcity is a decision, not a number.
 */
export const SHOP: StashItem[] = [
  { id: 'feed', name: 'Feed her', detail: `Bond +${BOND.feed}. Once a night.`, cost: 4 },
  // Hard only. Filtered out of the panel on Normal, where the homestead starts whole.
  { id: 'repair', name: 'Patch the homestead', detail: `+${REPAIR.hp} HP. Never a scar.`, cost: REPAIR.cost },
  { id: 'oil', name: 'A drum of oil', detail: 'Permanent +25 starting oil, every night.', cost: 10 },
  {
    id: 'lamp',
    name: 'A better lamp',
    detail: `Every lantern you place, +${BETTER_LAMP_BONUS}px radius. Permanent.`,
    cost: 15,
  },
  {
    id: 'salt',
    name: 'Salt by the sack',
    detail: `Salt lines take ${SALT_SACK_BONUS} more crossings before they are gone. Permanent.`,
    cost: 18,
  },
  { id: 'toy:bear', name: 'The Weighted Bear', detail: 'Unlocks the toy.', cost: 16 },
  { id: 'toy:monkey', name: 'The Sock Monkey', detail: 'Unlocks the toy.', cost: 18 },
  { id: 'toy:scrap', name: 'The Old Blanket Scrap', detail: 'Unlocks the toy.', cost: 20 },
]

/**
 * The oil drum is the only repeatable sink, so surplus flows there — and an uncapped
 * permanent +25/night would trivialise the economy it is supposed to serve. Raised 3 → 4
 * with the reprice, because there is now enough else to buy that the drum is competing
 * rather than defaulting.
 */
export const MAX_OIL_UPGRADES = 4

// ─── §7.2 Hard — *The Hollow Remembers* ─────────────────────────────────────

/**
 * Hard mode's scars.
 *
 * **The homestead never falls and the run never restarts.** At 0 HP it takes a permanent,
 * named injury, refills to a new and lower maximum, and the night carries on. Losing
 * compounds instead of resetting, which is the entire mode — by Night 7 a scarred run is a
 * different game with fewer resources, a slower dog and a weaker bell.
 *
 * Scars cannot be repaired at any price. Homestead HP persists across all seven nights,
 * recovers +20 free between them, and stash buys 15 more for 10.
 *
 * ⚠ **Two of the doc's five effects name systems that do not exist, and are substituted
 * rather than shipped dead.** A scar the player cannot feel is worse than no scar: the
 * mode's whole promise is that every one of them is nameable.
 *
 *  - *Burnt wing* is "−1 ward slot" in the doc. There is no ward-slot system — nothing
 *    caps how many wards you may place — and inventing one here would rebalance Normal
 *    too, for the sake of a difficulty mode. Substituted with a permanent oil cut, which
 *    is the same shape of loss (you can build less) through a system that exists.
 *  - *Split spring box* halves hose amplification, and the spring line is unbuilt
 *    (§5.3 — it needs detour pathfinding). Substituted with the salt penalty, which is the
 *    closest live equivalent: a ward gets meaningfully worse for the rest of the run.
 *
 * Restore both when their systems land.
 */
export interface Scar {
  name: string
  maxHp: number
  /** What the player is told. It has to be nameable or the mode does not work. */
  effect: string
  /** True where the doc's own effect could not be honoured. */
  substituted?: boolean
}

export const SCARS: Scar[] = [
  {
    name: 'Burnt wing',
    maxHp: 85,
    effect: 'Starting oil −20, every night for the rest of the run.',
    substituted: true,
  },
  { name: 'Broken porch', maxHp: 70, effect: "Kara's Down recovery 25s → 40s." },
  { name: 'Cracked bell frame', maxHp: 55, effect: 'Church bell cooldown 45s → 70s.' },
  {
    name: 'Split spring box',
    maxHp: 40,
    effect: 'Salt lines take 3 fewer crossings.',
    substituted: true,
  },
  { name: 'Roof gone', maxHp: 25, effect: 'Fog nights lose another 15% of your light.' },
]

/** Everything the accumulated scars do, resolved once at the start of a night. */
export interface ScarEffects {
  maxHp: number
  oilPenalty: number
  downDuration: number | null
  bellCooldown: number | null
  saltPenalty: number
  extraFog: number
}

export function scarEffects(scars: number): ScarEffects {
  return {
    maxHp: scars > 0 ? (SCARS[Math.min(scars, SCARS.length) - 1]?.maxHp ?? 25) : 100,
    oilPenalty: scars >= 1 ? 20 : 0,
    downDuration: scars >= 2 ? 40 : null,
    bellCooldown: scars >= 3 ? 70 : null,
    saltPenalty: scars >= 4 ? 3 : 0,
    extraFog: scars >= 5 ? 0.15 : 0,
  }
}

// ─── Persistence ────────────────────────────────────────────────────────────

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...EMPTY, toys: [...STARTING_TOYS] }
    const p = JSON.parse(raw) as Partial<Progress>
    return {
      bond: clamp(p.bond, 0, 100),
      stash: clamp(p.stash, 0, 9999),
      toys: Array.isArray(p.toys) ? (p.toys as ToyId[]) : [...STARTING_TOYS],
      oilUpgrades: clamp(p.oilUpgrades, 0, 20),
      saltSack: p.saltSack === true,
      betterLamp: p.betterLamp === true,
      hard: p.hard === true,
      scars: clamp(p.scars, 0, SCARS.length + 1),
      homesteadHp: clamp(p.homesteadHp, 0, 100),
    }
  } catch {
    return { ...EMPTY, toys: [...STARTING_TOYS] }
  }
}

/** Everything back to the First Night: bond, stash, toys, upgrades, difficulty, scars. */
export function freshProgress(): Progress {
  return { ...EMPTY, toys: [...STARTING_TOYS] }
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // Private browsing, full quota, a locked-down work machine. Losing progress is
    // survivable; throwing is not.
  }
}

function clamp(v: unknown, lo: number, hi: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return lo
  return Math.max(lo, Math.min(hi, Math.floor(v)))
}
