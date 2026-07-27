/**
 * Every number the design doc specifies, in one place.
 *
 * Each block cites the section it comes from. If you change a value here, change it
 * in docs/design-doc.md too — the doc is the source of truth, this file is its
 * transcription. Anything NOT in the doc does not belong in this file; it has not
 * been decided yet.
 */

// ─── §2.1 The three bands ───────────────────────────────────────────────────
// The Bright band was cut by the 2026-07-27 consultation ruling: +25% inside a
// 21px ring only ever rewarded overlap, which was already dominant.

export const AMBIENT_LIGHT = 0.08
export const BAND_DIM = 0.15
export const BAND_LIT = 0.35

// ─── §2.2 Accumulation and falloff ──────────────────────────────────────────

/**
 * Flat-core falloff (2026-07-27 ruling): full intensity out to this fraction of a
 * light's radius, then a smoothstep to zero at the edge. The old ^1.6 exponent made
 * authored numbers lie — radius 150 delivered a 77px kill zone. Under flat-core the
 * same lantern delivers lit to 127px and visible to 139px: authored ≈ delivered.
 */
export const FALLOFF_CORE = 0.6
/** L is multiplied by (1 − FOG_PENALTY × fogDensity). */
export const FOG_PENALTY = 0.5

// ─── §5 Wards: Lantern Post ─────────────────────────────────────────────────

/**
 * Roster split (build-order step 3, consult §4): the lantern is PURE LIGHT and deals
 * no damage. It makes ground fightable; something else has to do the fighting. This
 * is the change that makes "reveal" and "kill" two separate purchases.
 */
export const LANTERN = {
  cost: 15,
  intensity: 0.85,
  radius: 120,
  color: 0xffc078,
  flicker: 0.06,
  /** Not from the doc: overlap is the point, exact stacking is degenerate. */
  minSpacing: 50,
} as const

/**
 * Cold Iron — a board of nails laid along the road bed. Real folklore: iron burns
 * spirits. It only bites what is standing on it IN LIGHT, so an iron strip in the
 * dark is an investment waiting for a lantern, not a defense.
 *
 * A walker at 30 px/s dwells 3.0s on the 90px strip → 7 ticks → 56 damage per pass.
 */
export const COLD_IRON = {
  cost: 25,
  /** Laid along the road; auto-orients to the nearest road segment. */
  length: 90,
  /** Wide enough to cover the walkers' ±9px wobble. */
  width: 26,
  tickDamage: 8,
  tickInterval: 0.4,
  minSpacing: 50,
} as const

// ─── §7 Difficulty and failure ──────────────────────────────────────────────

export const HOMESTEAD_MAX_HP = 100

/** §7 porch damage table. Only the enemies that exist so far. */
export const PORCH_DAMAGE = {
  roadWalker: 8,
} as const

// ─── §9 The ball stash economy ──────────────────────────────────────────────
// 2026-07-27 ruling: kills accelerate, they never gate. The old kills-only economy
// was a death spiral — a bad opening was unrecoverable by construction.

/** Guaranteed, paid when a wave is cleared. The worst-case player can still build. */
export const OIL_PER_WAVE = 25
export const OIL_PER_LIT_KILL = 4
export const NIGHT_1_STARTING_OIL = 75

// ─── §6 Enemy roster ────────────────────────────────────────────────────────

/**
 * Retuned for the split roster (consult §1-S5 target): the baseline enemy dies to
 * one lantern + one Cold Iron with ~25% margin. Iron deals 56 per pass; 45 HP dies
 * at the sixth tick, 2.4s into a 3.0s dwell. Lanterns alone now kill nothing at all —
 * a lit road with no iron is a road you can watch them walk down.
 */
export const ROAD_WALKER = {
  hp: 45,
  speed: 30,
  radius: 9,
  color: 0x8fa9b8,
  /** Seconds the body takes to fall and fade. Purely presentation. */
  deathDuration: 0.85,
} as const

// ─── Session ────────────────────────────────────────────────────────────────

/** Fast-forward multiplier. Near-universal in the genre; toggled with F. */
export const FAST_FORWARD = 2

// ─── §3 Kara ────────────────────────────────────────────────────────────────

/** §3.1. Rises to 350 at Bond T1, which is not built yet. */
export const EAR_PERK_RADIUS = 280
/** §3.2. She tells you this long before the threat becomes visible. */
export const EAR_PERK_LEAD = 2.0

// ─── §6 / §11 Night pacing ──────────────────────────────────────────────────

/** §11: 3 waves, 55–70s each, 12s between. Counts are first-pass tuning. */
export const WAVE_BREAK = 12

export const NIGHT_1_WAVES = [
  { count: 6, gap: 4.0 },
  { count: 8, gap: 3.5 },
  { count: 10, gap: 3.0 },
] as const
