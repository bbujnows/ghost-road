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
  /**
   * A lantern cannot fire the instant something becomes damageable. Without this,
   * two overlapping lanterns land 35 damage in a single frame the moment a walker
   * crosses into the light — 58% of its health before the player sees it happen.
   */
  initialDelay: 0.3,
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
 * A lantern does 14 / 0.55s ≈ 25.5 dps and a walker is exposed for 5.1s crossing one
 * lantern's 154px Lit chord, so a single lantern deals ~130 damage per pass.
 *
 * 120 HP makes that **one pass, one kill, with almost no margin** — which is the
 * number that makes the lighting puzzle exist. At the original 60 the pass overkilled
 * by 2x, so two overlapping lanterns killed in half a second and the Bright band bonus
 * never mattered: overlapping was strictly better than spreading, and the central
 * decision of the game collapsed.
 */
export const ROAD_WALKER = {
  hp: 120,
  speed: 30,
  radius: 9,
  color: 0x8fa9b8,
  /** Seconds the body takes to fall and fade. Purely presentation. */
  deathDuration: 0.85,
} as const

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
