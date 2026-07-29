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
/**
 * §2.2 fog. **Fog shrinks a light's radius; it does not dim it.**
 *
 * The doc specified a flat multiplier on L and, measured, that turned out to be pure
 * scenery: the falloff core is flat at 1.0, so scaling the total only bites at the
 * fringe. At the doc's own Night 7 density of 0.9 a lantern's lit reach went from 102px
 * to **91px** — an 11% haircut on the night the road is supposed to be unnavigable.
 *
 * This is the third time flat-core has hollowed out a threshold-based lever (see also
 * lantern intensity and Graveyard Iron's Dim tier). Radius is the only thing that is
 * felt. Under the numbers below, fog 0.9 cuts the lit pool to **50px, half a clear
 * night**, which is what the design always meant.
 *
 * Ambient is deliberately not scaled: fog does not make the dark darker, it makes the
 * lights smaller.
 */
export const FOG_RADIUS_PENALTY = 0.55
export const FOG_INTENSITY_PENALTY = 0.25

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

// ─── Ward upgrades (consult §4) ─────────────────────────────────────────────
//
// Two branches, two tiers each, bought with oil during the night. **Taking a tier
// commits the ward to that branch** — the other one closes. That exclusivity is the
// whole point: four nodes you can all buy is not build identity, it is a shopping list.
//
// The consult has branches unlocked with stash between nights. Stash is not built, so
// both branches are open from the start; the exclusivity rule already does the work
// that matters.

export type BranchId = 'storm' | 'mirror' | 'graveyard' | 'rail'

export interface LanternTier {
  cost: number
  radius: number
  /** Pool stretch along the road axis, and across it. 1/1 is a circle. */
  along: number
  across: number
  /** Multiplier on how long a Tallow Man's snuff lasts. 0 means he cannot. */
  snuffScale: number
  note: string
}

export const LANTERN_BASE: Omit<LanternTier, 'cost' | 'note'> = {
  radius: LANTERN.radius,
  along: 1,
  across: 1,
  snuffScale: 1,
}

/**
 * **Storm Glass** — a taller chimney and a heavier flame. Bigger, and progressively
 * beyond the Tallow Man's reach.
 *
 * Raising *intensity* would have been the obvious lever and it is a trap: under
 * flat-core falloff, 0.85 → 1.0 moves the lit radius from 107px to 108px. The core is
 * flat, so brightness buys almost nothing and only radius is felt. This is the kind of
 * thing that has to be measured before it is written into an upgrade tree.
 */
export const STORM_TIERS: LanternTier[] = [
  {
    cost: 15,
    radius: 135,
    along: 1,
    across: 1,
    snuffScale: 0.5,
    note: 'A storm chimney. Bigger pool, and a snuff lasts half as long.',
  },
  {
    cost: 25,
    radius: 150,
    along: 1,
    across: 1,
    snuffScale: 0,
    note: 'Brass cap and doubled glass. The Tallow Man cannot put it out at all.',
  },
]

/**
 * **Mirror Back** — a tin reflector behind the flame, which is how period lanterns
 * actually threw a directional beam. The same light, poured along the road bed instead
 * of wasted in the trees either side.
 */
export const MIRROR_TIERS: LanternTier[] = [
  {
    cost: 15,
    radius: LANTERN.radius,
    along: 1.35,
    across: 0.85,
    snuffScale: 1,
    note: 'A tin reflector. The pool stretches along the road and narrows across it.',
  },
  {
    cost: 25,
    radius: LANTERN.radius,
    along: 1.7,
    across: 0.75,
    snuffScale: 1,
    note: 'Ground glass and polished tin. A long throw straight down the road bed.',
  },
]

export interface IronTier {
  cost: number
  length: number
  tickDamage: number
  /** Speed multiplier for anything standing on it. 1 is no slow. */
  slow: number
  /** The illumination a target needs before the nails bite it. */
  threshold: number
  note: string
}

export const IRON_BASE: Omit<IronTier, 'cost' | 'note'> = {
  length: COLD_IRON.length,
  tickDamage: COLD_IRON.tickDamage,
  slow: 1,
  threshold: BAND_LIT,
}

/**
 * **Graveyard Iron** — nails pulled from a cemetery fence. Hits far harder, and at the
 * second tier it bites anything merely *visible* rather than only what is properly lit.
 *
 * That second tier deliberately bends the game's founding rule, and it is allowed to:
 * the consult's roster explicitly wants dark-capable exceptions that prove the light
 * rule. Note it lowers the bar to **Dim, not Dark** — a thing standing in true darkness
 * is still invisible and still untouchable, always.
 *
 * ⚠ **Measured, the Dim exception is worth far less than it sounds.** Under flat-core
 * falloff a lantern's dim reach is 92.9% of its radius against the lit band's 85%, so
 * dropping the bar only widens the killable ring around each lamp by **20% of area**.
 * This is the same trap as raising intensity (see STORM_TIERS): flat-core squashes the
 * bands together geometrically, so anything that moves a *threshold* buys much less than
 * anything that moves a *radius*. Assume nothing about band-based upgrades; measure them.
 *
 * What the tier is actually worth is the doubled bite — and one combo that fell out of
 * it. A bubble peaks at L=0.30, squarely Dim by design, and lights a ~40px circle above
 * the Dim line. **Graveyard Iron II under a bubble is a kill zone with no lantern at
 * all.** Two charges, five seconds each, anywhere she can reach. That was not designed;
 * it is what happens when two honest systems meet, and it is worth more than the ring.
 */
export const GRAVEYARD_TIERS: IronTier[] = [
  {
    cost: 25,
    length: COLD_IRON.length,
    tickDamage: 12,
    slow: 1,
    threshold: BAND_LIT,
    note: 'Cemetery nails. Half again the bite.',
  },
  {
    cost: 40,
    length: COLD_IRON.length,
    tickDamage: 16,
    slow: 1,
    threshold: BAND_DIM,
    note: 'Twice the bite — and it takes anything you can merely see, not only what is lit.',
  },
]

/**
 * **Rail Iron** — torn up from the logging line this road was cut for. Longer, and at
 * the second tier rough enough to wade through.
 *
 * The slow compounds with its own length, which is why it is 0.75 and not lower: dwell
 * is `length / (speed × slow)`, so both halves of the upgrade multiply. Measured, a
 * walker takes 18 ticks crossing a fully-upgraded strip against 7 on a base one.
 */
export const RAIL_TIERS: IronTier[] = [
  {
    cost: 25,
    length: 130,
    tickDamage: COLD_IRON.tickDamage,
    slow: 1,
    threshold: BAND_LIT,
    note: 'Rail salvage. Half again the length of road covered.',
  },
  {
    cost: 40,
    length: 165,
    tickDamage: COLD_IRON.tickDamage,
    slow: 0.75,
    threshold: BAND_LIT,
    note: 'Ties and rail both. Long, and rough enough to wade through.',
  },
]

export const BRANCHES: Record<
  BranchId,
  { ward: WardKind; name: string; role: string; tiers: (LanternTier | IronTier)[] }
> = {
  storm: { ward: 'lantern', name: 'Storm Glass', role: 'bigger, and cannot be put out', tiers: STORM_TIERS },
  mirror: { ward: 'lantern', name: 'Mirror Back', role: 'the same light, aimed', tiers: MIRROR_TIERS },
  graveyard: { ward: 'iron', name: 'Graveyard Iron', role: 'bites harder, then bites in the dim', tiers: GRAVEYARD_TIERS },
  rail: { ward: 'iron', name: 'Rail Iron', role: 'longer, then slows', tiers: RAIL_TIERS },
}

export type WardKind = 'lantern' | 'iron'

export const BRANCHES_FOR: Record<WardKind, [BranchId, BranchId]> = {
  lantern: ['storm', 'mirror'],
  iron: ['graveyard', 'rail'],
}

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
  unseen: 7,
  bellWitch: 25,
  greenbrier: 10,
  drover: 40,
} as const

// ─── §9 The ball stash economy ──────────────────────────────────────────────
// 2026-07-27 ruling: kills accelerate, they never gate. The old kills-only economy
// was a death spiral — a bad opening was unrecoverable by construction.

/** Guaranteed, paid when a wave is cleared. The worst-case player can still build. */
export const OIL_PER_WAVE = 25
export const OIL_PER_LIT_KILL = 4

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

/**
 * The Unseen (§6). "Alpha `0.06 + 0.94 × L`. Genuinely invisible in the dark."
 *
 * It keeps the hard rule — below Dim it is not drawn at all, like everything else — but
 * above it the doc's curve makes it consistently ghostlier than a walker at the same
 * illumination: 0.20 against 0.50 at the Dim line, 0.53 against 0.94 in good light. It is
 * never quite *there*. Kara's ears are the reliable way to know it is coming, which is
 * why Night 3 pairs it with the boss that makes her ears lie.
 */
export const UNSEEN = {
  hp: 38,
  speed: 34,
  radius: 9,
} as const

// ─── §6 Bosses (nights 3, 5, 7 — consult §7) ────────────────────────────────
//
// Every boss carries a **faint self-light**, strong enough to hold itself at Dim and no
// stronger. So a boss is always visible and never killable on its own terms: you can see
// exactly what is coming and still have to light it properly to touch it. A boss the
// player cannot see is unfair; one that lights its own grave is not a boss.

export const BOSS_GLOW = { intensity: 0.12, radius: 70 } as const

/**
 * The Bell Witch (Night 3). She attacks your instruments rather than your homestead.
 *
 * While she is alive, **Kara perks at things that are not there** — the false-positive
 * mechanic §3.2 reserves for Night 5, brought forward and given an author. The player's
 * most reliable read becomes unreliable on the same night the Unseen arrives, which is
 * the whole point of the pairing.
 */
export const BELL_WITCH = {
  hp: 260,
  speed: 20,
  radius: 14,
  /** Seconds between phantom threats planted in Kara's hearing. */
  lieInterval: 4.5,
  /** How long each phantom lingers. */
  lieDuration: 2.6,
} as const

/**
 * The Greenbrier Ghost (Night 5). Real West Virginia folklore — Zona Heaster Shue, 1897,
 * whose mother's testimony about her daughter's broken neck convicted a man. She is used
 * here because she is settler history rather than living sacred tradition (§12.2).
 *
 * §6: "She does not attack. She *walks*, and everything she passes rises behind her. Kill
 * the walker, not the risen." Her porch damage is nominal; the flood is the threat, and
 * killing the risen instead of her is the mistake the fight is built to punish.
 */
export const GREENBRIER = {
  hp: 220,
  speed: 26,
  radius: 12,
  /** Seconds between one more thing standing up behind her. */
  raiseInterval: 2.4,
} as const

/**
 * The Drover (Night 7). He leads the whole hollow's dead down the road at once.
 *
 * The same raising verb as the Greenbrier Ghost, twice as fast and on a body twice as
 * hard, at the end of the only night where fog has halved every lantern you own.
 */
export const DROVER = {
  hp: 400,
  speed: 18,
  radius: 15,
  raiseInterval: 1.3,
} as const

/**
 * Wind (Night 5+). **A squall line that crosses the hollow, not a switch that turns the
 * lanterns off** (rewritten 2026-07-29, fix-plan F1).
 *
 * ⚠ The first version snuffed *every* non-Storm lantern *simultaneously* for 5s. The
 * recorded session shows what that actually was: `6 lanterns out · 4s`, the whole map
 * dark but the cabin, seven enemies on the road, none visible, none damageable, nothing
 * to press. That is not difficulty — difficulty is a problem with an answer. It was a
 * periodic removal of the information layer, the damage layer and the decision space at
 * once, on a timer the player could not influence.
 *
 * As rebuilt, a gust is a horizontal **band** that sweeps across the map. It snuffs
 * lanterns as the front reaches them and only inside the band, so:
 *
 *  - **The map is never fully dark.** There is always somewhere lit and somewhere to act.
 *  - **Placement is the answer.** Lanterns spread across the vertical lose a few at a
 *    time; lanterns clustered in one band all go out together. A free, positional counter
 *    — the lesson PvZ's fog teaches with Plantern and Blover.
 *  - **Storm Glass becomes a choice, not a tax.** Armour the two lanterns in your worst
 *    band instead of needing to armour all six.
 *  - **The warning is actionable.** 1.8s and a visible band is enough to move Kara toward
 *    the stretch about to go dark — a decision *inside* a gust, which is what was missing.
 *
 * `maxShare` is the guarantee that stops it degenerating: a single gust may never take
 * more than half the lanterns, whatever the draw. A rule that keeps a mechanic honest is
 * worth more than the severity it costs.
 */
export const GUST = {
  /** Per lantern. Shorter than the old global 5s because outages now stagger. */
  duration: 3.5,
  warning: 1.8,
  /** px/s the front travels. Crosses the board in about 1.4s.  */
  sweepSpeed: 1000,
  /** Half the band's height. 120 covers a third of the play area. */
  halfHeight: 120,
  /**
   * Hard cap on the fraction of lanterns one gust may take.
   *
   * **This was 0.5 and it broke the mechanic it was protecting.** Measured over 2000
   * bands: at 0.5, six lanterns spread down the road lost exactly 3 and six lanterns
   * clustered in one band also lost exactly 3 — the cap saved the clumper, so the
   * positional counter the whole rewrite exists to create did not exist. At 0.67 a
   * clustered build loses 4 and a spread build loses 2–3, which is the decision.
   */
  maxShare: 0.67,
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

/**
 * §3.2 Hold. Requires the Rope toy equipped that night (§4) — the consult moved it off
 * the bond track so it is a per-night build choice rather than a permanent unlock.
 *
 * "Plants her; enemies within 90px are slowed 35% and cannot pass. Max 8s. She takes
 * damage the whole time." *Cannot pass* is literal: anything inside the radius is held
 * at her position on the road and does not advance past it. She is a wall for 8 seconds,
 * which is the only time in this game she stops things directly.
 *
 * The doc specifies that it costs her health but not how much. 6 HP/s is set so a full
 * 8-second hold costs 48 of her 100 — survivable once, ruinous twice, and it only bills
 * her while something is actually pushing against her.
 */
export const HOLD = {
  radius: 90,
  slow: 0.65,
  maxDuration: 8,
  cooldown: 20,
  /** Per second, and only while at least one thing is being held. */
  strain: 6,
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

export type EnemyKind =
  | 'walker'
  | 'crawler'
  | 'boneDog'
  | 'tallowMan'
  | 'unseen'
  | 'bellWitch'
  | 'greenbrier'
  | 'drover'

export interface Group {
  kind: EnemyKind
  count: number
  /** Seconds between members of this group. */
  gap: number
  /** Seconds after the wave begins that the first one steps onto the road. */
  start: number
}

// The wave tables live in `nights.ts` — one per night, seven of them. Starting oil, fog
// and wind are per-night too, so NIGHT_1_STARTING_OIL went with them.
