/**
 * Every number the design doc specifies, in one place.
 *
 * Each block cites the section it comes from. If you change a value here, change it
 * in docs/design-doc.md too — the doc is the source of truth, this file is its
 * transcription. Anything NOT in the doc does not belong in this file; it has not
 * been decided yet.
 */

// ─── §2.1 The three bands ───────────────────────────────────────────────────

export const AMBIENT_LIGHT = 0.08
export const BAND_DIM = 0.15
export const BAND_LIT = 0.35
export const BAND_BRIGHT = 0.75

/** §2.4 Bright band pays a damage bonus, to reward overlapping lanterns. */
export const BRIGHT_DAMAGE_BONUS = 1.25

// ─── §2.2 Accumulation and falloff ──────────────────────────────────────────

/** Hot core, long soft tail. Must match the gradient texture in lighting.ts. */
export const FALLOFF_EXPONENT = 1.6
/** L is multiplied by (1 − FOG_PENALTY × fogDensity). */
export const FOG_PENALTY = 0.5

// ─── §5 Wards: Lantern Post ─────────────────────────────────────────────────

export const LANTERN = {
  cost: 30,
  intensity: 0.85,
  radius: 150,
  damage: 14,
  fireInterval: 0.55,
  color: 0xffc078,
  flicker: 0.06,
  /** Not from the doc: overlap is the point, exact stacking is degenerate. */
  minSpacing: 50,
} as const

// ─── §7 Difficulty and failure ──────────────────────────────────────────────

export const HOMESTEAD_MAX_HP = 100

/** §7 porch damage table. Only the enemies that exist so far. */
export const PORCH_DAMAGE = {
  roadWalker: 8,
} as const

// ─── §9 The ball stash economy ──────────────────────────────────────────────

export const OIL_PER_LIT_KILL = 6
export const NIGHT_1_STARTING_OIL = 90

// ─── §6 Enemy roster ────────────────────────────────────────────────────────

/**
 * Road Walker HP and speed were not in the doc; derived and added to it in v1.2.
 *
 * A lantern does 14 / 0.55s ≈ 25.5 dps. 60 HP means a single lantern needs ~2.4s
 * on a walker, and the walker crosses one 150px lantern pool in ~10s at 30 px/s —
 * so one lantern comfortably handles a trickle and is overwhelmed by a group.
 * That ratio is the whole tuning target for Night 1.
 */
export const ROAD_WALKER = {
  hp: 60,
  speed: 30,
  radius: 9,
  color: 0x8fa9b8,
} as const

// ─── §6 / §11 Night pacing ──────────────────────────────────────────────────

/** §11: 3 waves, 55–70s each, 12s between. Counts are first-pass tuning. */
export const WAVE_BREAK = 12

export const NIGHT_1_WAVES = [
  { count: 6, gap: 4.0 },
  { count: 8, gap: 3.5 },
  { count: 10, gap: 3.0 },
] as const
