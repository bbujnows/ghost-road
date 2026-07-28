import { Container, Graphics } from 'pixi.js'
import {
  BAND_DIM,
  BAND_LIT,
  BELL_WITCH,
  BONE_DOG,
  BOSS_GLOW,
  CRAWLER,
  DEATH_DURATION,
  DROVER,
  GREENBRIER,
  PORCH_DAMAGE,
  ROAD_WALKER,
  TALLOW_MAN,
  UNSEEN,
} from './balance'
import type { DamageType, EnemyKind } from './balance'
import { damageMultiplier } from './lighting'
import type { Light, LightingSystem } from './lighting'
import { HOMESTEAD, ROAD } from './world'
import type { Vec2 } from './world'

/**
 * The roster, and the counterplay pass (consult §4).
 *
 * Every enemy here has one thing it punishes and one thing that answers it, and no two
 * of them are answered the same way:
 *
 *  - **Road Walker** — the baseline. Answered by light plus iron, like everything.
 *  - **Crawler** — punishes gaps in coverage by crossing them before you react.
 *    Answered by a lit iron strip, which kills it outright.
 *  - **Tallow Man** — punishes lanterns placed tight against the road bed by putting
 *    them out. Answered spatially (set the post back) or by Kara (she squares up).
 *  - **Bone Dog** — punishes leaving Kara parked in the open. Answered by the Blanket,
 *    by recalling her, or best of all by walking her over your iron and letting the
 *    strip do it.
 *
 * The Unseen, Drownd Girl, Hant Cat, Hollow Kin and the Fetch are specced (design doc
 * §6) and not built. Build order is consult §9.
 */

/** Structural, so nothing here has to import the ward module. `Lantern` satisfies it. */
export interface Snuffable {
  readonly x: number
  readonly y: number
  readonly snuffed: boolean
  /** False if the flame beat him — a Storm Glass lamp cannot be put out. */
  snuff(seconds: number): boolean
}

/** What a Bone Dog needs to know about Kara. `Kara` satisfies it. */
export interface Quarry {
  readonly x: number
  readonly y: number
  /** False while she is under the blanket, coming out from under it, or already Down. */
  readonly targetable: boolean
  bite(amount: number): void
}

/** Everything on the board that an enemy is allowed to react to, or do to it. */
export interface EnemyContext {
  lighting: LightingSystem
  kara: Quarry
  lanterns: Snuffable[]
  /** Raise something onto the road at a point already travelled. Bosses use this. */
  raise: (kind: EnemyKind, pathT: number) => void
  /** Plant a phantom in Kara's hearing. The Bell Witch's whole attack. */
  lie: (x: number, y: number, seconds: number) => void
}

export abstract class Enemy {
  x: number
  y: number
  hp: number
  readonly maxHp: number
  readonly speed: number
  readonly porchDamage: number
  abstract readonly kind: EnemyKind

  readonly gfx = new Container()

  /** Fraction of a damage type this shrugs off, 0–1. Missing means none. */
  protected resists: Partial<Record<DamageType, number>> = {}

  /**
   * Speed multiplier for this frame. Wards write it before the enemy moves and `update`
   * clears it afterward, so a slow lasts exactly as long as the thing standing on it —
   * no timers, no stacking bugs, and nothing to clean up when a ward is destroyed.
   */
  slowFactor = 1

  /** The part that flinches, tints and faces. The shadow stays flat on the ground. */
  protected readonly frame = new Container()
  protected readonly shadow = new Graphics()

  /** Index into the road plus the fraction travelled into the current segment. */
  protected t = 0
  protected readonly path: Vec2[] = ROAD
  protected wobble = Math.random() * Math.PI * 2
  protected gait = Math.random() * Math.PI * 2
  /** How far it strays from the centre line, so they are not beads on a wire. */
  protected drift = 9
  protected gaitRate = 3.2
  /** Squash applied on top of facing and the hit flash. Set by animate(). */
  protected stretch = { x: 1, y: 1 }
  protected facing = 1
  private hitFlash = 0

  /** True once it has left the road bed and is steering for itself. */
  protected offRoad = false

  constructor(stats: { hp: number; speed: number; porchDamage: number }) {
    this.hp = stats.hp
    this.maxHp = stats.hp
    this.speed = stats.speed
    this.porchDamage = stats.porchDamage
    this.x = ROAD[0].x
    this.y = ROAD[0].y
    this.gfx.addChild(this.shadow, this.frame)
  }

  get dead() {
    return this.hp <= 0
  }

  /** How far down the road it is. Bosses raise things at their own position. */
  get pathT() {
    return this.t
  }

  /**
   * False once it has left the road bed. Anything that steers for itself has no
   * meaningful `pathT`, so nothing may clamp it back onto the ruts — doing that to a
   * Bone Dog mid-chase teleports it across the map.
   */
  get onRoad() {
    return !this.offRoad
  }

  /**
   * A stable sliver of road, so a queue held at one point stands in a line rather than
   * stacking on a single pixel.
   */
  readonly holdOffset = Math.random() * 0.05

  seek(t: number) {
    this.t = Math.max(0, Math.min(this.path.length - 1.001, t))
    const seg = Math.floor(this.t)
    const frac = this.t - seg
    this.x = this.path[seg].x + (this.path[seg + 1].x - this.path[seg].x) * frac
    this.y = this.path[seg].y + (this.path[seg + 1].y - this.path[seg].y) * frac
  }

  /** How visible it is at a given illumination. The Unseen overrides this. */
  protected alphaAt(L: number): number {
    return L < BAND_DIM ? 0 : 0.5 + 0.5 * Math.min(1, (L - BAND_DIM) / 0.4)
  }

  /** True once it has reached the porch. */
  get arrived() {
    if (this.offRoad) return Math.hypot(this.x - HOMESTEAD.x, this.y - HOMESTEAD.y) < 26
    return this.t >= this.path.length - 1
  }

  /**
   * §2.1: nothing standing in the dark can be hurt at all, whatever hits it. Resists
   * apply on top of that gate, never instead of it.
   *
   * `threshold` is how much light the attacker needs its target to be standing in.
   * Everything defaults to Lit; Graveyard Iron's second tier lowers its own bar to Dim,
   * which is the one sanctioned way to bend this rule. **It never goes below Dim** — a
   * thing in true darkness is invisible and untouchable, always, by anything.
   */
  applyDamage(
    amount: number,
    type: DamageType,
    lighting: LightingSystem,
    threshold = BAND_LIT,
  ): number {
    if (lighting.lightAt(this.x, this.y) < Math.max(BAND_DIM, threshold)) return 0

    const dealt = amount * (1 - (this.resists[type] ?? 0))
    if (dealt <= 0) return 0

    this.hp -= dealt
    this.hitFlash = 0.09
    return dealt
  }

  /** Whether a ward may currently target it. Mirrors the damage gate. */
  targetable(lighting: LightingSystem): boolean {
    return damageMultiplier(lighting.bandAt(this.x, this.y)) > 0
  }

  /**
   * Where it will be after `seconds`, following the road rather than a straight line.
   * Kara's Ear-Perk needs this: she tells the player about a threat before it becomes
   * visible, which means asking where it is about to be.
   */
  futurePosition(seconds: number): Vec2 {
    let t = this.t
    let remaining = this.speed * seconds

    while (remaining > 0 && t < this.path.length - 1) {
      const seg = Math.min(Math.floor(t), this.path.length - 2)
      const from = this.path[seg]
      const to = this.path[seg + 1]
      const segLength = Math.hypot(to.x - from.x, to.y - from.y) || 1
      const frac = t - seg
      const left = segLength * (1 - frac)

      if (remaining < left) {
        const f = frac + remaining / segLength
        return { x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f }
      }

      remaining -= left
      t = seg + 1
    }

    const end = this.path[this.path.length - 1]
    return { x: end.x, y: end.y }
  }

  /**
   * Which way it is pointing. Taken from where it is *going*, never from the frame's x
   * delta: the drift wobble moves x by more per frame than a slow walk does down a
   * near-vertical stretch of road, so a delta test makes them flicker back and forth.
   */
  protected face(dx: number) {
    if (Math.abs(dx) > 0.5) this.facing = dx > 0 ? 1 : -1
  }

  /** Walk the road. The default behaviour, and what most of the roster does. */
  protected advance(dt: number, speed = this.speed) {
    const segment = Math.min(Math.floor(this.t), this.path.length - 2)
    const from = this.path[segment]
    const to = this.path[segment + 1]
    const segLength = Math.hypot(to.x - from.x, to.y - from.y) || 1

    this.t = Math.min(this.path.length - 1, this.t + (speed * this.slowFactor * dt) / segLength)

    const frac = this.t - segment
    this.x = from.x + (to.x - from.x) * frac
    this.y = from.y + (to.y - from.y) * frac

    // The segment's own heading, which is stable across the whole segment.
    this.face(to.x - from.x)
  }

  /** Move. Override to do anything other than walk down the road. */
  protected behave(dt: number, _ctx: EnemyContext) {
    this.advance(dt)
  }

  /** Pose the body for this frame. `gait` has already been advanced. */
  protected abstract animate(dt: number): void

  update(dt: number, ctx: EnemyContext) {
    this.behave(dt, ctx)

    if (!this.offRoad) {
      this.wobble += dt * 1.7
      this.x += Math.sin(this.wobble) * this.drift
    }

    this.gait += dt * this.gaitRate
    this.stretch = { x: 1, y: 1 }
    this.animate(dt)

    // §2.1: in the dark band an enemy is invisible, full stop. This is the rule the
    // whole game is built on, and it has to be literal or none of it lands.
    const L = ctx.lighting.lightAt(this.x, this.y)
    this.gfx.alpha = this.alphaAt(L)
    this.gfx.position.set(this.x, this.y)

    // Hit feedback: a scorch flash and a flinch. Tint multiplies, so the flash pushes
    // cold greys toward burnt amber rather than simply brightening them.
    this.hitFlash = Math.max(0, this.hitFlash - dt)
    const hit = this.hitFlash > 0
    this.frame.tint = hit ? 0xffc9a0 : 0xffffff
    this.frame.scale.set(
      this.facing * this.stretch.x * (hit ? 1.05 : 1),
      this.stretch.y * (hit ? 0.96 : 1),
    )

    // Consumed. Any ward still holding it will write it again next frame.
    this.slowFactor = 1
  }
}

/**
 * The Road Walker. §6: "Baseline. Walks the road toward the homestead."
 *
 * A hunched figure in rags rather than a dot. Everything about it is built to read at a
 * glance in half-light: a bowed silhouette, a slow sway, and a hem that trails. It has
 * no face — whatever is under the hood is the player's problem to imagine.
 */
export class RoadWalker extends Enemy {
  readonly kind = 'walker' as const

  private readonly hem = new Graphics()
  private readonly armNear = new Container()
  private readonly armFar = new Container()

  constructor() {
    super({ hp: ROAD_WALKER.hp, speed: ROAD_WALKER.speed, porchDamage: PORCH_DAMAGE.roadWalker })

    const { color } = ROAD_WALKER
    const dark = 0x4d5c68
    // Tall enough to read as a person standing over a dog — Kara is ~29px at the
    // shoulder, so this keeps the scale relationship between them legible.
    const H = 46

    this.shadow.ellipse(0, 2, 11, 4).fill({ color: 0x000000, alpha: 0.3 })

    // Far arm, behind the body.
    this.armFar.position.set(-1, -H + 12)
    this.armFar.addChild(new Graphics().roundRect(-2, 0, 4, 15, 2).fill(dark))

    // Robe: narrow at the shoulders, flaring to a ragged hem.
    const robe = new Graphics()
    robe
      .moveTo(-6, -H + 6)
      .quadraticCurveTo(-9, -H / 2, -11, -4)
      .lineTo(11, -4)
      .quadraticCurveTo(9, -H / 2, 6, -H + 6)
      .fill({ color, alpha: 0.82 })
    robe.ellipse(0, -H + 7, 8, 5.5).fill({ color, alpha: 0.9 })
    // The hood, and the nothing inside it.
    robe.ellipse(1, -H + 1, 6.5, 7).fill({ color: dark, alpha: 0.95 })
    robe.ellipse(2, -H + 2, 4.5, 5).fill({ color: 0x101820, alpha: 0.9 })

    this.hem.position.set(0, -4)

    this.armNear.position.set(3, -H + 12)
    this.armNear.addChild(new Graphics().roundRect(-2, 0, 4.5, 16, 2).fill({ color, alpha: 0.9 }))

    this.frame.addChild(this.armFar, robe, this.hem, this.armNear)
  }

  protected animate(_dt: number) {
    // A slow, wrong walk. It sways rather than strides, and never quite finds a rhythm.
    this.frame.rotation = Math.sin(this.gait) * 0.055
    this.frame.position.y = Math.abs(Math.sin(this.gait)) * -1.4
    this.armNear.rotation = Math.sin(this.gait) * 0.35
    this.armFar.rotation = -Math.sin(this.gait) * 0.3

    this.hem.clear()
    for (let i = 0; i < 5; i++) {
      const x = -10 + i * 5
      const sway = Math.sin(this.gait * 2 + i * 0.9) * 1.6
      this.hem
        .moveTo(x, 0)
        .lineTo(x + sway, 4 + (i % 2 ? 3 : 1))
        .lineTo(x + 4, 0)
        .fill({ color: ROAD_WALKER.color, alpha: 0.7 })
    }

    // Wounded things stoop.
    this.stretch.y = 1 - (1 - this.hp / this.maxHp) * 0.12
  }
}

/**
 * The Crawler. Whatever it was, it does not stand up any more.
 *
 * Deliberately the opposite silhouette to the walker — low and wide against tall and
 * narrow — because in half-light the outline is all the player gets. It hauls itself
 * along on long forelimbs in a reach-and-drag cycle, and it is quick.
 */
export class Crawler extends Enemy {
  readonly kind = 'crawler' as const

  /** Shoulder and elbow of each forelimb — it hauls itself with these. */
  private readonly arms: { shoulder: Container; elbow: Container }[] = []
  private readonly spine = new Container()

  constructor() {
    super({ hp: CRAWLER.hp, speed: CRAWLER.speed, porchDamage: PORCH_DAMAGE.crawler })
    // Low to the ground, so it barely strays from the ruts.
    this.drift = 5
    this.gaitRate = 5.6

    const skin = 0x77878f
    const deep = 0x4a5a63

    this.shadow.ellipse(0, 1, 14, 4).fill({ color: 0x000000, alpha: 0.32 })

    // Long forelimbs, rooted at the shoulders, reaching well ahead of the body.
    for (const [tone, x] of [
      [deep, -1],
      [skin, 2],
    ] as const) {
      const shoulder = new Container()
      shoulder.position.set(x + 6, -11)

      const elbow = new Container()
      elbow.position.set(0, 12)
      elbow.addChild(
        new Graphics()
          .roundRect(-1.6, 0, 3.2, 11, 1.4)
          .fill(tone)
          // Splayed fingers, dug into the road.
          .moveTo(-3, 11)
          .lineTo(-4.5, 14)
          .moveTo(0, 11)
          .lineTo(0, 14.5)
          .moveTo(3, 11)
          .lineTo(4.5, 14)
          .stroke({ width: 1.1, color: tone, cap: 'round' }),
      )

      shoulder.addChild(new Graphics().roundRect(-1.8, 0, 3.6, 13, 1.6).fill(tone), elbow)
      this.arms.push({ shoulder, elbow })
    }

    // Torso: a flattened wedge dragging a ruined pelvis.
    const body = new Graphics()
    body
      .moveTo(-15, -3)
      .quadraticCurveTo(-12, -12, -2, -13)
      .quadraticCurveTo(8, -14, 12, -10)
      .quadraticCurveTo(14, -5, 9, -2)
      .quadraticCurveTo(-3, 0, -15, -3)
      .fill(skin)
    // Ribs showing through.
    for (let i = 0; i < 4; i++) {
      body
        .moveTo(-2 + i * 3.4, -12)
        .lineTo(-3 + i * 3.4, -3)
        .stroke({ width: 0.9, color: deep, alpha: 0.55 })
    }
    // Trailing legs, useless, dragged.
    body
      .moveTo(-13, -5)
      .quadraticCurveTo(-22, -3, -27, 0)
      .moveTo(-13, -3)
      .quadraticCurveTo(-21, 0, -25, 2)
      .stroke({ width: 3, color: deep, cap: 'round' })

    // Head hung low and thrust forward, looking at the dirt.
    const head = new Graphics()
    head.ellipse(15, -8, 6, 4.5).fill(skin)
    head.ellipse(18, -7, 3, 2.4).fill(0x141c22)

    this.spine.addChild(body, head)
    this.frame.addChild(this.arms[0].shoulder, this.spine, this.arms[1].shoulder)
  }

  protected animate(_dt: number) {
    // Reach, plant, haul. The body surges between the reaches rather than gliding.
    const cycle = Math.sin(this.gait)
    const surge = Math.max(0, Math.sin(this.gait * 2))

    for (let i = 0; i < this.arms.length; i++) {
      const a = Math.sin(this.gait + (i ? Math.PI : 0))
      this.arms[i].shoulder.rotation = -0.55 - a * 0.5
      this.arms[i].elbow.rotation = 0.35 + Math.max(0, a) * 0.6
    }

    this.spine.position.set(surge * 2.2, -Math.abs(cycle) * 1.1)
    this.spine.rotation = cycle * 0.06
  }
}

/**
 * The Tallow Man. Rendered fat that learned to walk, with a wick where a face belongs.
 *
 * He is not interested in the house. He stops beside a lantern, reaches up, and pinches
 * the flame out — and the light he takes goes into his own wick, which flares while he
 * is doing it. That flare is the tell, and the 1.2s it lasts is the window Kara can
 * spoil by squaring up at him.
 */
export class TallowMan extends Enemy {
  readonly kind = 'tallowMan' as const

  private readonly armReach = new Container()
  private readonly wick = new Graphics()
  private readonly body = new Container()

  private target: Snuffable | null = null
  private windup = 0
  private stagger = 0
  /**
   * Lanterns Kara has already driven him off. Without this he re-reaches for the same
   * lamp the instant the stagger ends, and a dog parked beside one post locks him out
   * of the night forever — she would beat the boss by standing still, which is the
   * opposite of what she is for. She saves *this* lamp; he goes and finds another.
   */
  private readonly spoiled = new Set<Snuffable>()
  /** 0 idle, 1 mid-snuff. Drives the reach and the wick flare. */
  private effort = 0
  /** Rises while Kara has him rooted, so the flinch is visible. */
  private cowed = 0

  constructor() {
    super({ hp: TALLOW_MAN.hp, speed: TALLOW_MAN.speed, porchDamage: PORCH_DAMAGE.tallowMan })
    this.drift = 4
    this.gaitRate = 1.9
    // Wax shrugs off light. Inert until a light-damage ward exists — see DamageType.
    this.resists = { light: TALLOW_MAN.lightResist }

    const wax = 0xd9cdb0
    const shade = 0xa89a7d
    const H = 38

    this.shadow.ellipse(0, 2, 15, 5).fill({ color: 0x000000, alpha: 0.34 })

    const lump = new Graphics()
    // Squat and wide, slumped like something left too near a fire.
    lump
      .moveTo(-13, 0)
      .quadraticCurveTo(-16, -16, -11, -26)
      .quadraticCurveTo(-6, -34, 0, -34)
      .quadraticCurveTo(7, -34, 11, -26)
      .quadraticCurveTo(16, -16, 14, 0)
      .fill(wax)
    // Runs of set wax down the near side.
    for (let i = 0; i < 4; i++) {
      const x = -8 + i * 6
      lump
        .moveTo(x, -26 + i * 2)
        .quadraticCurveTo(x - 1.5, -14, x + 1, -2)
        .stroke({ width: 2.2, color: shade, alpha: 0.55 })
    }
    // Pooled at his feet, always spreading.
    lump.ellipse(0, 0, 14, 4).fill({ color: shade, alpha: 0.75 })
    // A dented hollow where a face would be, and the wick standing out of his crown.
    lump.ellipse(2, -25, 4.5, 5.5).fill({ color: shade, alpha: 0.6 })
    lump.moveTo(-1, -34).lineTo(0, -H - 2).stroke({ width: 1.6, color: 0x2a241c })

    // Melted mitt of a hand on a short arm, which is what does the pinching.
    this.armReach.position.set(8, -26)
    this.armReach.addChild(
      new Graphics()
        .roundRect(-2.4, 0, 4.8, 14, 2.2)
        .fill(wax)
        .circle(0, 15, 3.6)
        .fill(shade),
    )

    // The stolen light, burning on top of him.
    this.wick.ellipse(0, 0, 2.2, 3.6).fill({ color: 0xbfe0ff, alpha: 0.9 })
    this.wick.ellipse(0, 1, 4, 6).fill({ color: 0x7fa8d8, alpha: 0.3 })
    this.wick.position.set(0, -H - 4)

    this.body.addChild(lump, this.armReach, this.wick)
    this.frame.addChild(this.body)
  }

  /** True while he is reaching for a flame. The HUD and the player both want this. */
  get snuffing() {
    return this.target !== null
  }

  protected behave(dt: number, ctx: EnemyContext) {
    if (this.stagger > 0) {
      this.stagger -= dt
      this.cowed = Math.min(1, this.cowed + dt * 6)
      return
    }
    this.cowed = Math.max(0, this.cowed - dt * 3)

    // Kara squares up. She is silent except when she is territorial at home, and this
    // is home — she does not have to touch him, she only has to mean it.
    if (
      this.target &&
      ctx.kara.targetable &&
      Math.hypot(ctx.kara.x - this.x, ctx.kara.y - this.y) < TALLOW_MAN.stareRadius
    ) {
      this.spoiled.add(this.target)
      this.target = null
      this.windup = 0
      this.effort = 0
      this.stagger = TALLOW_MAN.stagger
      return
    }

    if (this.target) {
      // Someone else put it out first, or it relit and moved on.
      if (this.target.snuffed) {
        this.target = null
        this.windup = 0
      } else {
        this.windup += dt
        this.effort = Math.min(1, this.windup / TALLOW_MAN.windup)
        if (this.windup >= TALLOW_MAN.windup) {
          // A Storm Glass lamp refuses him. He does not try that one twice.
          if (!this.target.snuff(TALLOW_MAN.snuffDuration)) this.spoiled.add(this.target)
          this.target = null
          this.windup = 0
        }
        // He stops to do it. That pause is what puts him on your iron.
        return
      }
    }

    this.effort = Math.max(0, this.effort - dt * 2)

    for (const lantern of ctx.lanterns) {
      if (lantern.snuffed || this.spoiled.has(lantern)) continue
      if (Math.hypot(lantern.x - this.x, lantern.y - this.y) > TALLOW_MAN.reach) continue
      this.target = lantern
      this.windup = 0
      return
    }

    this.advance(dt)
  }

  protected animate(_dt: number) {
    // A heavy, uneven trudge. Wax does not have a gait so much as a lean.
    this.body.rotation = Math.sin(this.gait) * 0.05 - this.cowed * 0.22
    this.body.position.set(-this.cowed * 5, Math.abs(Math.sin(this.gait)) * -1.1)

    // Reaching up for the flame, and flaring as he takes it.
    this.armReach.rotation = -this.effort * 2.1
    const flare = 0.35 + this.effort * 1.9
    this.wick.scale.set(flare * (1 + Math.sin(this.gait * 7) * 0.12), flare)
    this.wick.alpha = 0.5 + this.effort * 0.5

    // He slumps as he takes damage, which on a wax man is the obvious read.
    this.stretch.y = 1 - (1 - this.hp / this.maxHp) * 0.18
    this.stretch.x = 1 + (1 - this.hp / this.maxHp) * 0.1
  }
}

/**
 * The Bone Dog. Kara's shape with everything warm taken out of it, and no white on it
 * anywhere — which is the whole of §2.4 stated as a threat, and a rehearsal for the
 * Fetch on Night 6.
 *
 * It walks the road until it catches her, then it leaves the road entirely. Nothing you
 * built covers where it goes, so the answer is her: put her under the blanket, call her
 * off, or lead it across your iron and let the strip have it.
 */
export class BoneDog extends Enemy {
  readonly kind = 'boneDog' as const

  private readonly spine = new Container()
  private readonly skull = new Container()
  private readonly legs: Container[] = []

  private biteTimer = 0
  private hunting = false
  /** Decays after each bite, so the lunge is visible. */
  private lunge = 0
  /** Whatever it is currently running at. Ear-Perk extrapolates along this. */
  private aimX = HOMESTEAD.x
  private aimY = HOMESTEAD.y

  constructor() {
    super({ hp: BONE_DOG.hp, speed: BONE_DOG.speed, porchDamage: PORCH_DAMAGE.boneDog })
    this.drift = 6
    this.gaitRate = 7.4

    const bone = 0xb9b6a6
    const shade = 0x86846f

    this.shadow.ellipse(0, 1, 13, 4).fill({ color: 0x000000, alpha: 0.32 })

    // Four spindly legs, too long for the body.
    for (let i = 0; i < 4; i++) {
      const leg = new Container()
      const far = i < 2
      leg.position.set(i % 2 === 0 ? -9 : 9, -13)
      leg.addChild(
        new Graphics()
          .moveTo(0, 0)
          .lineTo(far ? -1.5 : 1.5, 7)
          .lineTo(0, 13)
          .stroke({ width: far ? 1.8 : 2.4, color: far ? shade : bone, cap: 'round' }),
      )
      this.legs.push(leg)
      this.frame.addChild(leg)
    }

    // Ribcage and a whip of a spine.
    const body = new Graphics()
    body.moveTo(-12, -16).quadraticCurveTo(0, -21, 12, -17).stroke({ width: 2.4, color: bone })
    for (let i = 0; i < 5; i++) {
      const x = -8 + i * 4.2
      body
        .moveTo(x, -18 - Math.sin(i * 0.6) * 1.5)
        .quadraticCurveTo(x + 1.5, -13, x, -9)
        .stroke({ width: 1.4, color: bone, alpha: 0.85 })
    }
    // Tail: a bare string of vertebrae.
    body.moveTo(-12, -16).quadraticCurveTo(-19, -15, -23, -20).stroke({ width: 1.6, color: shade })

    // Long wrong skull, nothing like her broad one.
    this.skull.position.set(13, -19)
    this.skull.addChild(
      new Graphics()
        .moveTo(-4, -3)
        .quadraticCurveTo(4, -5, 11, -2)
        .quadraticCurveTo(12, 1, 8, 2)
        .quadraticCurveTo(0, 3, -4, 1)
        .fill(bone)
        .circle(1, -1.5, 1.6)
        .fill(0x0d1216)
        // The jaw, always a little open.
        .moveTo(2, 2)
        .lineTo(10, 2.5)
        .stroke({ width: 1.2, color: shade }),
    )

    this.spine.addChild(body, this.skull)
    this.frame.addChild(this.spine)
  }

  /** It only counts as reaching the porch if it was ever going there. */
  get arrived() {
    if (this.hunting) return false
    return super.arrived
  }

  futurePosition(seconds: number): Vec2 {
    if (!this.offRoad) return super.futurePosition(seconds)
    // Off the road it is running at something, so extrapolate the run.
    const d = Math.hypot(this.aimX - this.x, this.aimY - this.y) || 1
    const reach = Math.min(d, BONE_DOG.chaseSpeed * seconds)
    return {
      x: this.x + ((this.aimX - this.x) / d) * reach,
      y: this.y + ((this.aimY - this.y) / d) * reach,
    }
  }

  protected behave(dt: number, ctx: EnemyContext) {
    const kara = ctx.kara
    const d = Math.hypot(kara.x - this.x, kara.y - this.y)
    this.hunting = kara.targetable && d < BONE_DOG.senseRadius
    this.lunge = Math.max(0, this.lunge - dt * 4)

    if (this.hunting) {
      // The moment it commits it stops being a road problem and starts being hers.
      this.offRoad = true
      this.aimX = kara.x
      this.aimY = kara.y

      if (d > BONE_DOG.reach) {
        // Slowed here too — Rail Iron laid between her and the road is a real answer.
        const v = BONE_DOG.chaseSpeed * this.slowFactor * dt
        this.x += ((kara.x - this.x) / d) * v
        this.y += ((kara.y - this.y) / d) * v
        this.face(kara.x - this.x)
        return
      }
      // Close enough to bite: it is looking at her, not running past her.
      this.face(kara.x - this.x)

      this.biteTimer -= dt
      if (this.biteTimer <= 0) {
        this.biteTimer = BONE_DOG.biteInterval
        kara.bite(BONE_DOG.bite)
        this.lunge = 1
      }
      return
    }

    if (this.offRoad) {
      // It has lost her — she went under the blanket, or she went Down. It is not going
      // to find its way back to the ruts, so it goes at the house instead.
      this.aimX = HOMESTEAD.x
      this.aimY = HOMESTEAD.y
      const dx = HOMESTEAD.x - this.x
      const dy = HOMESTEAD.y - this.y
      const dd = Math.hypot(dx, dy) || 1
      const v = this.speed * this.slowFactor * dt
      this.x += (dx / dd) * v
      this.y += (dy / dd) * v
      this.face(dx)
      return
    }

    this.advance(dt)
  }

  protected animate(_dt: number) {
    // A rattling, four-beat run. Nothing about it is comfortable.
    const a = Math.sin(this.gait)
    for (let i = 0; i < this.legs.length; i++) {
      this.legs[i].rotation = Math.sin(this.gait + (i % 2 ? Math.PI : 0) + (i < 2 ? 0.4 : 0)) * 0.75
    }
    this.spine.position.y = Math.abs(a) * -1.6
    this.spine.rotation = a * 0.05

    // Head down and forward while it is hunting; the lunge snaps it further.
    this.skull.rotation = (this.hunting ? 0.22 : 0.05) + this.lunge * 0.5
    this.skull.position.x = 13 + this.lunge * 4
  }
}

/**
 * The Unseen. §6: alpha `0.06 + 0.94 × L`, genuinely invisible in the dark.
 *
 * It keeps the hard rule — nothing below Dim is drawn — but above the line the doc's
 * curve makes it consistently fainter than anything else on the road, so it never quite
 * resolves. There is no trick to it and no counter to buy: you learn it is there from
 * Kara's ears, or you learn it is there when it reaches the porch.
 */
export class Unseen extends Enemy {
  readonly kind = 'unseen' as const

  private readonly veil = new Container()
  private readonly limbs: Graphics

  constructor() {
    super({ hp: UNSEEN.hp, speed: UNSEEN.speed, porchDamage: PORCH_DAMAGE.unseen })
    this.drift = 11
    this.gaitRate = 2.4

    const pale = 0xc4d2d8
    const H = 50

    // No shadow. It does not sit on the ground the way the others do.
    const body = new Graphics()
    body
      .moveTo(-4, -H)
      .quadraticCurveTo(-9, -H / 2, -7, -6)
      .quadraticCurveTo(0, -2, 7, -6)
      .quadraticCurveTo(9, -H / 2, 4, -H)
      .fill({ color: pale, alpha: 0.22 })
    // A suggestion of a head, and nothing in it.
    body.ellipse(0, -H + 4, 5, 6.5).fill({ color: pale, alpha: 0.3 })
    // The one hard edge on it: the outline, which is all you ever really see.
    body
      .moveTo(-4, -H)
      .quadraticCurveTo(-9, -H / 2, -7, -6)
      .moveTo(4, -H)
      .quadraticCurveTo(9, -H / 2, 7, -6)
      .stroke({ width: 1, color: pale, alpha: 0.5 })

    this.limbs = new Graphics()
    this.veil.addChild(body, this.limbs)
    this.frame.addChild(this.veil)
  }

  /** §6's curve. Fainter than a walker at every illumination, always. */
  protected alphaAt(L: number): number {
    return L < BAND_DIM ? 0 : 0.06 + 0.94 * L
  }

  protected animate(_dt: number) {
    // It does not walk. It drifts, and the bottom of it never quite settles.
    this.veil.position.y = Math.sin(this.gait * 0.9) * 2.2
    this.veil.rotation = Math.sin(this.gait * 0.6) * 0.045

    this.limbs.clear()
    for (let i = 0; i < 2; i++) {
      const sway = Math.sin(this.gait * 1.3 + i * 2.1) * 4
      this.limbs
        .moveTo(i ? 6 : -6, -34)
        .quadraticCurveTo(i ? 11 + sway : -11 + sway, -24, i ? 8 : -8, -14)
        .stroke({ width: 1.6, color: 0xc4d2d8, alpha: 0.35, cap: 'round' })
    }
  }
}

/**
 * Bosses.
 *
 * Every one of them carries a faint self-light — enough to hold itself at Dim and no
 * more. So a boss is always visible and never killable on its own terms: you can watch
 * exactly what is coming and still have to light it properly to touch it. A boss the
 * player cannot see is unfair; one that lights its own grave is not a boss.
 */
export abstract class Boss extends Enemy {
  /** Registered by the caller, because only it owns the lighting system. */
  readonly glow: Light = {
    x: 0,
    y: 0,
    radius: BOSS_GLOW.radius,
    color: 0xa8c4d8,
    intensity: BOSS_GLOW.intensity,
  }

  update(dt: number, ctx: EnemyContext) {
    super.update(dt, ctx)
    this.glow.x = this.x
    this.glow.y = this.y - 20
    // It goes out with them. A corpse should not keep lighting the road.
    if (this.dead) this.glow.intensity = 0
  }
}

/**
 * The Bell Witch (Night 3). She does not come for the homestead so much as for the one
 * instrument the player actually trusts.
 *
 * While she is alive, Kara perks at things that are not there. §3.2 reserves false
 * positives for Night 5 as ambient dread; here they have an author, they are frequent,
 * and they stop the moment she goes down — so the player can *earn* their radar back.
 */
export class BellWitch extends Boss {
  readonly kind = 'bellWitch' as const

  private readonly shroud = new Container()
  private readonly hands = new Graphics()
  private lieTimer = 1.5

  constructor() {
    super({ hp: BELL_WITCH.hp, speed: BELL_WITCH.speed, porchDamage: PORCH_DAMAGE.bellWitch })
    this.drift = 5
    this.gaitRate = 1.4

    const cloth = 0x3f4a55
    const pale = 0xd6dde2
    const H = 62

    this.shadow.ellipse(0, 2, 16, 5).fill({ color: 0x000000, alpha: 0.3 })

    const body = new Graphics()
    // A long skirt that never shows a foot.
    body
      .moveTo(-7, -H + 14)
      .quadraticCurveTo(-16, -H / 2, -19, 0)
      .lineTo(19, 0)
      .quadraticCurveTo(16, -H / 2, 7, -H + 14)
      .fill(cloth)
    // Bonnet, and the dark under its brim.
    body.ellipse(0, -H + 6, 10, 9).fill(cloth)
    body.ellipse(0, -H + 8, 7, 7).fill({ color: 0x0f151b, alpha: 0.92 })
    body.moveTo(-11, -H + 6).quadraticCurveTo(0, -H - 4, 11, -H + 6).fill(cloth)
    // A white collar, the only clean thing on her.
    body.moveTo(-6, -H + 14).quadraticCurveTo(0, -H + 18, 6, -H + 14).stroke({ width: 2.5, color: pale })

    // Hands up over where a face should be. She is not hiding it from you.
    this.hands.position.set(0, -H + 9)
    this.hands
      .ellipse(-5, 0, 3.6, 5)
      .fill(pale)
      .ellipse(5, 0, 3.6, 5)
      .fill(pale)

    this.shroud.addChild(body, this.hands)
    this.frame.addChild(this.shroud)
  }

  protected behave(dt: number, ctx: EnemyContext) {
    this.advance(dt)

    this.lieTimer -= dt
    if (this.lieTimer > 0) return
    this.lieTimer = BELL_WITCH.lieInterval

    // A phantom somewhere out in the dark, near enough for Kara to hear. It has no body
    // and never will — the player will send her, or trust her, and be wrong either way.
    const angle = Math.random() * Math.PI * 2
    const dist = 120 + Math.random() * 160
    ctx.lie(
      ctx.kara.x + Math.cos(angle) * dist,
      ctx.kara.y + Math.sin(angle) * dist,
      BELL_WITCH.lieDuration,
    )
  }

  protected animate(_dt: number) {
    this.shroud.position.y = Math.sin(this.gait) * 1.8 - 2
    this.shroud.rotation = Math.sin(this.gait * 0.7) * 0.03
    // The hands come away from her face just far enough, then go back.
    const peek = Math.max(0, Math.sin(this.gait * 0.5))
    this.hands.position.x = peek * 2.5
    this.hands.scale.set(1, 1 - peek * 0.15)
    this.stretch.y = 1 - (1 - this.hp / this.maxHp) * 0.1
  }
}

/**
 * The Greenbrier Ghost (Night 5). Real folklore: Zona Heaster Shue, 1897, whose mother's
 * testimony about her broken neck convicted a man — which is why her head sits wrong.
 *
 * §6: she does not attack. She walks, and everything she passes rises behind her. The
 * mistake the fight is built to punish is killing the risen instead of her.
 */
export class Greenbrier extends Boss {
  readonly kind = 'greenbrier' as const

  private readonly shroud = new Container()
  private readonly head = new Container()
  private raiseTimer = 1
  /** Pulses when something stands up behind her. */
  private surge = 0

  constructor() {
    super({ hp: GREENBRIER.hp, speed: GREENBRIER.speed, porchDamage: PORCH_DAMAGE.greenbrier })
    this.drift = 4
    this.gaitRate = 1.7

    const linen = 0xb9bfb4
    const shade = 0x8d9489
    const H = 56

    this.shadow.ellipse(0, 2, 14, 4.5).fill({ color: 0x000000, alpha: 0.28 })

    const body = new Graphics()
    body
      .moveTo(-6, -H + 12)
      .quadraticCurveTo(-14, -H / 2, -16, 0)
      .lineTo(16, 0)
      .quadraticCurveTo(14, -H / 2, 6, -H + 12)
      .fill({ color: linen, alpha: 0.88 })
    // Grave dirt up the hem.
    body.moveTo(-16, 0).quadraticCurveTo(0, -8, 16, 0).fill({ color: shade, alpha: 0.5 })
    // Arms hanging perfectly still. She is not reaching for anything.
    body
      .moveTo(-6, -H + 16)
      .quadraticCurveTo(-10, -H / 3, -9, -12)
      .moveTo(6, -H + 16)
      .quadraticCurveTo(10, -H / 3, 9, -12)
      .stroke({ width: 3, color: shade, cap: 'round' })

    // The head, at the angle that got a man hanged.
    this.head.position.set(0, -H + 8)
    this.head.rotation = 1.15
    this.head.addChild(
      new Graphics()
        .ellipse(0, 0, 6.5, 8)
        .fill(linen)
        .ellipse(-2, -1, 2, 2.6)
        .fill({ color: 0x14191c, alpha: 0.85 })
        .ellipse(2.4, -1, 2, 2.6)
        .fill({ color: 0x14191c, alpha: 0.85 }),
    )

    this.shroud.addChild(body, this.head)
    this.frame.addChild(this.shroud)
  }

  protected behave(dt: number, ctx: EnemyContext) {
    this.advance(dt)
    this.surge = Math.max(0, this.surge - dt * 2.5)

    this.raiseTimer -= dt
    if (this.raiseTimer > 0) return
    this.raiseTimer = GREENBRIER.raiseInterval

    // Behind her, not at her. What rises has the whole road still to walk, which is what
    // makes chasing the risen instead of her such an expensive mistake.
    ctx.raise('walker', Math.max(0, this.pathT - 0.12))
    this.surge = 1
  }

  protected animate(_dt: number) {
    this.shroud.position.y = Math.sin(this.gait) * 1.2 - this.surge * 2
    // She does not react to being hit. She reacts to what stands up behind her.
    this.head.rotation = 1.15 + Math.sin(this.gait * 0.6) * 0.05
    this.stretch.x = 1 + this.surge * 0.06
    this.stretch.y = (1 - (1 - this.hp / this.maxHp) * 0.08) * (1 + this.surge * 0.05)
  }
}

/**
 * The Drover (Night 7). The same raising verb as the Greenbrier Ghost, twice as fast, on
 * a body twice as hard, at the end of the only night where fog has halved every lantern
 * you own. There is no trick to him. There is only whether you built enough.
 */
export class Drover extends Boss {
  readonly kind = 'drover' as const

  private readonly frameBody = new Container()
  private readonly goad = new Container()
  private raiseTimer = 2
  private drive = 0

  constructor() {
    super({ hp: DROVER.hp, speed: DROVER.speed, porchDamage: PORCH_DAMAGE.drover })
    this.drift = 3
    this.gaitRate = 1.5

    const coat = 0x2f3740
    const trim = 0x5d6b73
    const H = 74

    this.shadow.ellipse(0, 3, 19, 6).fill({ color: 0x000000, alpha: 0.36 })

    const body = new Graphics()
    // A long drover's coat, shoulders far too wide.
    body
      .moveTo(-13, -H + 16)
      .quadraticCurveTo(-19, -H / 2, -16, 0)
      .lineTo(16, 0)
      .quadraticCurveTo(19, -H / 2, 13, -H + 16)
      .fill(coat)
    body.ellipse(0, -H + 17, 16, 7).fill(coat)
    // Hat with a brim wide enough to be the whole face.
    body.ellipse(0, -H + 6, 8, 7).fill(coat)
    body.moveTo(-17, -H + 6).quadraticCurveTo(0, -H + 12, 17, -H + 6).quadraticCurveTo(0, -H + 1, -17, -H + 6).fill(coat)
    body.moveTo(-9, -H + 3).quadraticCurveTo(0, -H - 3, 9, -H + 3).fill(trim)
    // Coat seams, so the silhouette is not a slab.
    body
      .moveTo(-6, -H + 18)
      .lineTo(-4, -4)
      .moveTo(6, -H + 18)
      .lineTo(4, -4)
      .stroke({ width: 1, color: trim, alpha: 0.4 })

    // The goad. He is not carrying it, he is using it.
    this.goad.position.set(12, -H + 26)
    this.goad.addChild(
      new Graphics()
        .moveTo(0, -14)
        .lineTo(2, 34)
        .stroke({ width: 2.4, color: 0x6b5a44, cap: 'round' })
        .circle(0, -15, 2.6)
        .fill(0x9fb8cf),
    )

    this.frameBody.addChild(body, this.goad)
    this.frame.addChild(this.frameBody)
  }

  protected behave(dt: number, ctx: EnemyContext) {
    this.advance(dt)
    this.drive = Math.max(0, this.drive - dt * 3)

    this.raiseTimer -= dt
    if (this.raiseTimer > 0) return
    this.raiseTimer = DROVER.raiseInterval

    ctx.raise(Math.random() < 0.35 ? 'crawler' : 'walker', Math.max(0, this.pathT - 0.1))
    this.drive = 1
  }

  protected animate(_dt: number) {
    this.frameBody.position.y = Math.abs(Math.sin(this.gait)) * -1.6
    this.frameBody.rotation = Math.sin(this.gait) * 0.03
    // He swings the goad and something gets up. The tell is worth watching for.
    this.goad.rotation = -0.15 - this.drive * 0.7
    this.stretch.y = 1 - (1 - this.hp / this.maxHp) * 0.09
  }
}

export function spawn(kind: EnemyKind): Enemy {
  if (kind === 'crawler') return new Crawler()
  if (kind === 'tallowMan') return new TallowMan()
  if (kind === 'boneDog') return new BoneDog()
  if (kind === 'unseen') return new Unseen()
  if (kind === 'bellWitch') return new BellWitch()
  if (kind === 'greenbrier') return new Greenbrier()
  if (kind === 'drover') return new Drover()
  return new RoadWalker()
}

/**
 * What is left when one of them goes down.
 *
 * It inherits the enemy's own display container, so it falls from exactly the pose it
 * died in. Nothing should ever blink out of existence — a kill the player cannot see
 * happen reads as a bug, which is precisely how it read on the first build.
 */
export class Corpse {
  readonly gfx: Container
  private t = 0
  private startAlpha: number

  constructor(gfx: Container) {
    this.gfx = gfx
    this.startAlpha = gfx.alpha
  }

  get finished() {
    return this.t >= DEATH_DURATION
  }

  update(dt: number) {
    this.t = Math.min(DEATH_DURATION, this.t + dt)
    const k = this.t / DEATH_DURATION

    // Buckles first, then goes over. Ease-out so the fall has some weight to it.
    const fall = 1 - Math.pow(1 - k, 2.2)
    this.gfx.rotation = fall * 1.25
    this.gfx.scale.set(1, 1 - fall * 0.45)
    // Holds its shape for a beat, then goes to nothing.
    this.gfx.alpha = this.startAlpha * (k < 0.3 ? 1 : Math.max(0, 1 - (k - 0.3) / 0.7))
  }
}
