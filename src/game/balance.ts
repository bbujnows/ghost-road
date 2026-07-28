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

/**
 * Damage types (consult §4 counterplay matrix). Iron is the only live source today —
 * Cold Iron is the only ward that deals damage at all. `light` is declared because the
 * Tallow Man's 50% light resist is real design that arrives intact the moment a
 * light-burn ward ships (Bottle Tree / Church Bell, build-order step 6). Carrying the
 * type now costs three lines; inventing a substitute counterplay and unpicking it later
 * would cost a great deal more.
 */
export type DamageType = 'iron' | 'light'

// ─── §7 Difficulty and failure ──────────────────────────────────────────────

export const HOMESTEAD_MAX_HP = 100

/** §7 porch damage table. */
export const PORCH_DAMAGE = {
  roadWalker: 8,
  crawler: 5,
  tallowMan: 12,
  boneDog: 6,
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
} as const

/** Seconds any body takes to fall and fade. Nothing may blink out of existence. */
export const DEATH_DURATION = 0.85

/**
 * The Crawler. Consult §4: "fast; outruns one pool. Countered by salt, iron strips."
 *
 * At 62 px/s it dwells 1.45s on a 90px strip — 3 guaranteed iron ticks, 24 damage — so
 * 22 HP means **one lit strip reliably kills it and a hair less would not.** The threat
 * is not durability, it is clock: it crosses the road's 1070px in 17s against the
 * walker's 36s, so a hole in your coverage is punished before you can patch it.
 */
export const CRAWLER = {
  hp: 22,
  speed: 62,
  radius: 8,
} as const

/**
 * The Tallow Man (§6, and Night 1's boss). He does not attack the homestead so much as
 * he attacks your ability to defend it: he stops beside a lantern, pinches the flame
 * out, and walks on.
 *
 * Two live counters, and the interesting one is spatial. He can only reach a lantern
 * within `reach` of where he walks, so setting a post back from the road bed buys it
 * immunity at the cost of covering less road — the first placement decision in this
 * game with two axes.
 *
 * The second is Kara. She is silent except when she is territorial at home, and this is
 * home: she squares up and he shies off it. That is the whole interrupt.
 *
 * 4.1s of dwell on a strip at 22 px/s is 10 ticks — 80 damage against 90 HP. One iron
 * strip deliberately does not finish him.
 */
export const TALLOW_MAN = {
  hp: 90,
  speed: 22,
  radius: 11,
  /** How close his walk must pass a lantern post for him to reach it. */
  reach: 58,
  /** Seconds of reaching before the flame goes out. The window Kara can spoil. */
  windup: 1.2,
  /** How long a snuffed lantern stays dark. */
  snuffDuration: 8,
  /** Kara within this, and squared up, stops him. */
  stareRadius: 80,
  /** Seconds he is rooted after she does it. */
  stagger: 2.0,
  /** Wax shrugs off light. Inert until a light-damage ward exists — see DamageType. */
  lightResist: 0.5,
} as const

/**
 * The Bone Dog (§6). The first thing on the road that wants Kara rather than the house.
 *
 * It is not durable. The catch is that it leaves the road to chase her, so everything
 * the player built never sees it. **The play this is built to teach: she is the bait.**
 *
 * 24 HP is set against the chase, not the walk — measured, a Bone Dog running at her
 * crosses a 90px strip in 1.15s and catches 3 iron ticks 88% of the time, which is
 * exactly 24. Any tougher and leading it over your own iron stops working, which would
 * leave the Blanket as the only answer and make the enemy a nuisance instead of a
 * puzzle. Standing her *on* the strip is the cleaner version: it closes to bite, the
 * iron does 20/s, and it is gone in 1.2s for two bites off her.
 *
 * 12 damage every 0.9s is 7.5s of one unattended dog to put her Down, 3.8s of two — and
 * 2× while she is on her back, so a single Show Belly next to one costs ~26 HP and two
 * dogs can Down her inside the 2.2s roll. That is the first time the vulnerability
 * written into Show Belly has ever cost anything.
 */
export const BONE_DOG = {
  hp: 24,
  /** On the road, before it has noticed her. */
  speed: 55,
  chaseSpeed: 78,
  radius: 9,
  senseRadius: 300,
  /** How close it must be to bite. */
  reach: 26,
  bite: 12,
  biteInterval: 0.9,
} as const

// ─── Session ────────────────────────────────────────────────────────────────

/** Fast-forward multiplier. Near-universal in the genre; toggled with F. */
export const FAST_FORWARD = 2

// ─── §3 Kara ────────────────────────────────────────────────────────────────

/**
 * §3.1 vitals. She is never permanently lost: at 0 HP she goes **Down**, limps to the
 * porch, and is unavailable. The player is blind for that stretch, and that is the
 * entire cost. Do not add a permadeath mode.
 */
export const KARA = {
  hp: 100,
  /** §3.1. Drops to 12s at Bond T3, which is not built. */
  downDuration: 25,
  /** She does not walk home at full speed with a chewed leg. */
  limpSpeed: 42,
  /**
   * NOT FROM THE DOC — a tuning decision made in the counterplay pass, flagged for
   * playtest. With no spring line built there is no way to heal her, so without this a
   * single bad wave 1 makes the rest of the night a slow bleed. Partial rather than full
   * so damage still carries between waves.
   */
  healPerWave: 25,
} as const

/**
 * §3.2 The Blanket. She loves being under blankets, so she goes willingly and comes out
 * reluctantly — the reluctance is the cost, and it is charged in seconds, not resources.
 *
 * Under it she is **untargetable**: this is the answer to the Bone Dog and the reason it
 * was not built until the Bone Dog existed. It is also a total blackout — no ears, no
 * light, no position. Six seconds minimum from `Z` to having her back.
 */
export const BLANKET = {
  /** Getting under. */
  settle: 0.5,
  /** She will not come out before this. */
  minimum: 3.0,
  /** §3.2: `3.0 − 0.4 × bondTier`, floor 1.0s. Bond is not built, so: 3.0. */
  coax: 3.0,
} as const

/** §3.1. Rises to 350 at Bond T1, which is not built yet. */
export const EAR_PERK_RADIUS = 280
/** §3.2. She tells you this long before the threat becomes visible. */
export const EAR_PERK_LEAD = 2.0

export const KARA_WALK_SPEED = 95

/**
 * §3.2 Show Belly. She flops onto her back the way she does when she is playing, and
 * her all-white belly turns up and throws reflected light across the area.
 *
 * The light is strong enough to push Dim ground into Lit on its own (0.9 + 0.08 ambient
 * clears the 0.35 threshold out to ~230px), which makes this the player's manual answer
 * to a clump the lanterns cannot reach. She is wide open for the whole 2.2s.
 */
export const SHOW_BELLY = {
  cooldown: 14,
  /** Light is up for this long, easing out over the final 0.4s. */
  flash: 1.4,
  /** Then she has to get back onto her feet. No commands accepted. */
  recovery: 0.8,
  lightIntensity: 0.9,
  lightRadius: 260,
  /** Damage multiplier against her while down. No threat targets her yet. */
  vulnerability: 2,
} as const

/**
 * §3.2 Bubbles. She chases them without hesitation — her blink, and the fastest
 * repositioning tool in the game.
 *
 * Each bubble is a weak drifting light: 0.22 + 0.08 ambient sits in the Dim band, so a
 * bubble trail **reveals without enabling damage.** That is the intended shape — it is
 * a scouting tool, not a portable lantern.
 */
export const BUBBLES = {
  maxCharges: 2,
  /** Seconds to regain one charge. */
  regen: 8,
  chaseSpeed: 180,
  lightIntensity: 0.22,
  lightRadius: 55,
  lifetime: 5,
} as const

// ─── §6 / §11 Night pacing ──────────────────────────────────────────────────

/** §11: 3 waves, 55–70s each, 12s between. Counts are first-pass tuning. */
export const WAVE_BREAK = 12

export type EnemyKind = 'walker' | 'crawler' | 'boneDog' | 'tallowMan'

export interface Group {
  kind: EnemyKind
  count: number
  /** Seconds between members of this group. */
  gap: number
  /** Seconds after the wave begins that the first one steps onto the road. */
  start: number
}

/**
 * ⚠ **Night 1 is currently a proving ground, not the shipping Night 1.**
 *
 * §6's night structure gives Night 1 Road Walkers and the Tallow Man as its boss, with
 * the Crawler on Night 2 and Bone Dogs on Night 3. Nights 2–7 are build-order step 7 and
 * do not exist, so every enemy written in the counterplay pass is folded into this one
 * night in order to be playable at all. The wave table below is a **test harness**;
 * restore it to walkers-plus-boss when step 7 lands.
 *
 * Pacing at the road's measured 1070px: wave 1 ≈ 56s, wave 2 ≈ 58s, wave 3 ≈ 83s (the
 * Tallow Man's 48.6s traverse is most of that tail). Night total ≈ 3:41 with breaks.
 */
export const NIGHT_1_WAVES: { groups: Group[] }[] = [
  // Teaches the baseline unchanged: light the road, lay iron in the light.
  { groups: [{ kind: 'walker', count: 6, gap: 4.0, start: 0 }] },
  // Teaches the clock. The crawler burst arrives while walkers still hold your attention.
  {
    groups: [
      { kind: 'walker', count: 6, gap: 4.5, start: 0 },
      { kind: 'crawler', count: 4, gap: 1.2, start: 14 },
    ],
  },
  // Teaches Kara. Bone Dogs come for her, then the Tallow Man comes for the lanterns.
  {
    groups: [
      { kind: 'walker', count: 6, gap: 4.0, start: 0 },
      { kind: 'crawler', count: 5, gap: 1.0, start: 10 },
      { kind: 'boneDog', count: 2, gap: 6, start: 20 },
      { kind: 'tallowMan', count: 1, gap: 0, start: 34 },
    ],
  },
]

/** For the break banner: how many things the coming wave puts on the road. */
export function waveSize(index: number): number {
  return NIGHT_1_WAVES[index].groups.reduce((n, g) => n + g.count, 0)
}
