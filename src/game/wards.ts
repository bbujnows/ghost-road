import { Container, Graphics } from 'pixi.js'
import {
  BOTTLE_TREE,
  BRANCHES,
  CHURCH_BELL,
  COLD_IRON,
  DARK_CAPABLE,
  FIDDLER,
  FIDDLER_BASE,
  IRON_BASE,
  LANTERN,
  LANTERN_BASE,
  SALT,
  SPRING,
} from './balance'
import type { BranchId, FiddlerTier, IronTier, LanternTier } from './balance'
import type { Light, LightingSystem } from './lighting'
import type { Enemy } from './enemies'
import { shade } from './shading'

/**
 * Upgrades, consult §4: two branches, two tiers, bought with oil during the night.
 *
 * **Taking a tier commits the ward to that branch.** `canTake()` is the single place
 * that rule lives, so nothing can accidentally sell a player the other side of a tree
 * they already chose.
 */
export class Upgradable {
  branch: BranchId | null = null
  tier = 0

  /** The branches this ward could still take a tier in, and what the next one costs. */
  canTake(id: BranchId): boolean {
    if (this.branch !== null && this.branch !== id) return false
    return this.tier < BRANCHES[id].tiers.length
  }

  nextCost(id: BranchId): number {
    return BRANCHES[id].tiers[this.tier]?.cost ?? 0
  }

  /** Returns the tier taken, or null if the branch was closed or already maxed. */
  take(id: BranchId) {
    if (!this.canTake(id)) return null
    const tier = BRANCHES[id].tiers[this.tier]
    this.branch = id
    this.tier += 1
    return tier
  }
}

/**
 * Wards, not guns — and after the roster split (consult §4), not even the lantern
 * shoots. Light and damage are separate purchases:
 *
 *  - The Lantern Post makes a stretch of road fightable. It deals nothing.
 *  - Cold Iron does the fighting, and only inside light.
 *
 * Salt lines, the church bell, the fiddler, the spring line, and the bottle tree are
 * specced (design doc §5 / consult §4) but not built. Build order is consult §9.
 */

/**
 * The fan of shafts a caged lamp throws down onto the road.
 *
 * Wedges rather than a cone, because the lamp has bars: the gaps are what make shafts.
 * Each is filled with a vertical gradient from lamplight to near-black — under additive
 * blending, near-black is indistinguishable from transparent, so the shaft fades out
 * along its length without needing a per-vertex alpha Graphics cannot give it.
 */
function buildRays(): Graphics {
  const rays = new Graphics()
  const COUNT = 7

  for (let i = 0; i < COUNT; i++) {
    const t = i / (COUNT - 1)
    // Fanned across the downward arc. Never straight up — there is a cap on the lamp.
    const a = Math.PI * 0.22 + t * Math.PI * 0.56
    const half = 0.05 + (i % 2) * 0.022
    const len = 44 * (0.72 + (i % 3) * 0.15)

    rays
      .moveTo(0, -6)
      .lineTo(Math.cos(a - half) * len, -6 + Math.sin(a - half) * len)
      .lineTo(Math.cos(a + half) * len, -6 + Math.sin(a + half) * len)
      .fill({ fill: shade(0xffd9a0, 0x0a0600), alpha: 0.14 })
  }

  rays.blendMode = 'add'
  return rays
}

export class Lantern {
  readonly light: Light
  readonly gfx = new Container()
  /** The flame itself, drawn above the darkness overlay and fed into the bloom. */
  readonly emissive = new Container()
  readonly x: number
  readonly y: number
  /** Which way the road runs here — a Mirror Back throws its oval along this. */
  readonly roadAngle: number

  readonly upgrades = new Upgradable()
  private stats: Omit<LanternTier, 'cost' | 'note'> = { ...LANTERN_BASE }
  /** Kept so a branch tier's authored radius does not silently discard the purchase. */
  private extraRadius = 0

  private housing = new Container()
  private flame = new Graphics()
  private fittings = new Graphics()
  /**
   * Shafts thrown through the lamp's cage.
   *
   * **Decoration, and deliberately kept that way.** They live in the emissive layer, not
   * the lightmap: `lightAt()` cannot see them and no ward reads them, so a ray falling
   * across a stretch of road promises the player nothing about whether that stretch is
   * lit. This game has been careful since the first build that the picture and the
   * gameplay agree, and the only safe way to add light that is *not* light is to keep it
   * somewhere the simulation cannot reach.
   *
   * Built once and animated by alpha alone — a fan of wedges rebuilt per lantern per
   * frame would be the most expensive decoration in the game for no visible gain.
   */
  private rays = buildRays()
  private sway = Math.random() * Math.PI * 2

  /** Seconds left in the dark. The Tallow Man puts this on the clock. */
  private out = 0
  /** Eased 1 → 0 as the flame dies, so nothing snaps off. */
  private burn = 1
  private smoke = new Graphics()

  constructor(
    x: number,
    y: number,
    roadAngle: number,
    lighting: LightingSystem,
    /** §9: "A better lamp" adds to this permanently, before any branch applies. */
    extraRadius = 0,
  ) {
    this.x = x
    this.y = y
    this.roadAngle = roadAngle
    this.stats.radius += extraRadius
    this.extraRadius = extraRadius

    this.light = lighting.add({
      x,
      y,
      radius: this.stats.radius,
      color: LANTERN.color,
      intensity: LANTERN.intensity,
      flicker: LANTERN.flicker,
      angle: roadAngle,
    })

    // A post driven into the roadside, with a hooked arm and a hung lamp.
    const post = new Graphics()
    post.ellipse(0, 0, 9, 3.5).fill({ color: 0x000000, alpha: 0.3 })
    post.moveTo(-2, 0).lineTo(-2.5, -40).lineTo(2.5, -40).lineTo(2, 0).fill(0x4a3d30)
    post.moveTo(-1, -34).lineTo(-1, -38).lineTo(11, -38).lineTo(11, -35).fill(0x3d3128)
    post.ellipse(-6, -1, 4, 2.5).fill(0x3a3830)
    post.ellipse(6, -1, 3.5, 2).fill(0x342f28)

    // The lamp: an iron cage with glass panes and a cap.
    const lamp = new Graphics()
    lamp.moveTo(-6, -12).lineTo(6, -12).lineTo(4.5, 0).lineTo(-4.5, 0).fill(0x5c4a3a)
    lamp.moveTo(-4.5, -11).lineTo(4.5, -11).lineTo(3.5, -1).lineTo(-3.5, -1).fill(0xffcf90)
    lamp.rect(-7, -14, 14, 3).fill(0x4a3d30)
    lamp.rect(-0.7, -12, 1.4, 12).fill({ color: 0x4a3d30, alpha: 0.7 })
    lamp.moveTo(-2, -14).quadraticCurveTo(0, -19, 2, -14).stroke({ width: 1.2, color: 0x3d3128 })

    this.housing.position.set(10, -36)
    this.housing.addChild(lamp, this.fittings)

    this.gfx.addChild(post, this.housing)
    this.gfx.position.set(x, y)

    // The flame reads through the darkness, the way the homestead's windows do.
    this.flame.ellipse(0, -6, 3, 5).fill({ color: 0xfff0cc, alpha: 0.95 })
    this.flame.ellipse(0, -6, 6, 9).fill({ color: 0xffc078, alpha: 0.35 })
    this.emissive.position.set(x + 10, y - 36)
    this.emissive.addChild(this.rays, this.flame, this.smoke)
  }

  /** True while it is putting out no light at all. */
  get snuffed() {
    return this.out > 0
  }

  /**
   * Where the player can click to select it — **the lamp up on the post, not the ground
   * around its base.** Laying iron right under a lantern is one of the best plays in the
   * game, and a generous hit box down at ground level would eat that click and select
   * the lantern instead.
   */
  contains(px: number, py: number): boolean {
    return Math.hypot(px - (this.x + 10), py - (this.y - 36)) < 20
  }

  /**
   * Buy the next tier. Returns its cost, or 0 if the branch was closed or maxed —
   * callers must treat 0 as "nothing happened" and not charge for it.
   */
  upgrade(id: BranchId): number {
    const tier = this.upgrades.take(id) as LanternTier | null
    if (!tier) return 0

    // The permanent purchase rides on top of the tier's authored radius rather than being
    // replaced by it — a player who bought a better lamp should not lose it by upgrading.
    const radius = tier.radius + this.extraRadius
    this.stats = {
      radius,
      along: tier.along,
      across: tier.across,
      snuffScale: tier.snuffScale,
    }

    this.applyLight()
    this.drawFittings()
    return tier.cost
  }

  /** The lamp gets visibly heavier as it is upgraded. An upgrade you cannot see is a
   * number, and numbers are the one thing this game's feedback pass decided against. */
  private drawFittings() {
    const g = this.fittings.clear()
    const branch = this.upgrades.branch
    const tier = this.upgrades.tier

    if (branch === 'storm') {
      // A taller storm chimney over the flame, then a brass cap and doubled glass.
      g.moveTo(-5, -13).lineTo(-4, -20).lineTo(4, -20).lineTo(5, -13).fill({ color: 0xbcd0d8, alpha: 0.3 })
      g.moveTo(-5, -13).lineTo(-4, -20).moveTo(5, -13).lineTo(4, -20).stroke({ width: 1, color: 0x7d8c8a })
      if (tier > 1) {
        g.rect(-6, -23, 12, 3.5).fill(0xb08d4a)
        g.rect(-4.5, -12.5, 9, 11).stroke({ width: 0.8, color: 0xd8e6ea, alpha: 0.45 })
      }
    } else if (branch === 'mirror') {
      // A tin reflector plate behind the flame, standing off the back of the cage.
      g.moveTo(-6, -13).quadraticCurveTo(-11, -6.5, -6, 0).lineTo(-4, -1).quadraticCurveTo(-8, -6.5, -4, -12).fill(0xa8b0ae)
      g.moveTo(-6.5, -12).quadraticCurveTo(-10.5, -6.5, -6.5, -1).stroke({ width: 0.9, color: 0xe6efee, alpha: 0.6 })
      if (tier > 1) {
        g.moveTo(6, -13).quadraticCurveTo(10, -6.5, 6, 0).stroke({ width: 1.4, color: 0xd8e6ea, alpha: 0.5 })
        g.rect(-12, -8, 3, 5).fill(0xb08d4a)
      }
    }
  }

  /** Seconds until it relights, for anything that wants to show the player. */
  get relightIn() {
    return Math.max(0, this.out)
  }

  /**
   * Put out. The lantern is not destroyed and the oil is not refunded — the player owns
   * a dark post for `seconds`, which is worse than owning nothing, because they built
   * their iron around where the light used to be.
   */
  snuff(seconds: number): boolean {
    // Storm Glass shortens this, and at its second tier refuses outright. Returning
    // false matters: without it the Tallow Man reaches for a lamp that never goes out,
    // never finishes, and never walks on — he would stand there for the rest of the
    // night. He has to be told the flame beat him.
    const scaled = seconds * this.stats.snuffScale
    if (scaled <= 0) return false
    this.out = Math.max(this.out, scaled)
    return true
  }

  /**
   * §2.5. Set once when a spring line is built or removed, not per frame — the mist does
   * not move, so neither does this.
   */
  setMisted(misted: boolean) {
    if (this.misted === misted) return
    this.misted = misted
    this.applyLight()
  }

  private misted = false

  /** Everything that decides the light's shape, in one place so nothing drifts. */
  private applyLight() {
    const scale = this.misted ? SPRING.lanternRadius : 1
    const radius = this.stats.radius * scale
    this.light.radius = radius * this.stats.along
    this.light.radiusY =
      this.stats.across === this.stats.along ? undefined : radius * this.stats.across
  }

  /** Called every frame, including while a wave is between spawns. */
  animate(dt: number) {
    this.sway += dt * 2.4
    this.housing.rotation = Math.sin(this.sway) * 0.045

    // Dies fast, comes back slowly — a pinched wick goes out at once, and relighting is
    // the lantern catching again rather than a switch being thrown.
    this.out = Math.max(0, this.out - dt)
    const want = this.out > 0 ? 0 : 1
    this.burn += (want - this.burn) * Math.min(1, dt * (want === 0 ? 14 : 2.6))

    // §2.5: the mist adds intensity as well as reach.
    this.light.intensity = (LANTERN.intensity + (this.misted ? SPRING.lanternIntensity : 0)) * this.burn

    const flicker = 1 + Math.sin(this.sway * 3.1) * 0.09
    this.flame.scale.set(this.burn * flicker, this.burn * (1 + Math.sin(this.sway * 2.3) * 0.13))
    this.flame.position.x = Math.sin(this.sway) * 1.2
    this.flame.alpha = this.burn

    // The shafts breathe with the flame and go out with it. Swung by the housing's own
    // sway, so the light moves because the lamp is moving rather than on its own clock.
    this.rays.alpha = this.burn * this.burn * (0.82 + Math.sin(this.sway * 3.1) * 0.18)
    this.rays.rotation = Math.sin(this.sway) * 0.045

    // A thread of smoke off the dead wick, so a dark post still reads as a lantern that
    // was put out rather than one you forgot to build.
    this.smoke.clear()
    if (this.burn < 0.6) {
      const fade = 1 - this.burn / 0.6
      for (let i = 0; i < 3; i++) {
        const t = (this.sway * 0.6 + i * 0.33) % 1
        this.smoke
          .circle(Math.sin(t * 6 + i) * 3, -8 - t * 22, 1.6 + t * 2.6)
          .fill({ color: 0x9aa7ad, alpha: 0.22 * fade * (1 - t) })
      }
    }
  }
}

/**
 * The Salt Line. **The exception that proves the light rule.**
 *
 * Not a light, not a trap, and the only damage in this game that does not care whether
 * you can see what it is hurting — it passes `DARK_CAPABLE`, which every other ward is
 * forbidden. Laid *across* the road rather than along it, because that is what a salt
 * line is: a thing you make them pay to cross.
 *
 * It is the cheap answer to a lane you cannot afford to light, and §9 makes sure it stays
 * cheap in the wrong direction: a kill outside the light pays 2 oil against 4 inside it.
 * Salt buys you road and keeps you poor.
 */
export class SaltLine {
  readonly gfx = new Container()
  readonly x: number
  readonly y: number
  /** Perpendicular to the road, unlike iron. */
  readonly angle: number

  private left: number = SALT.crossings
  private grains = new Graphics()
  private crossed = new Set<Enemy>()

  /** §9: "Salt by the sack" raises this permanently. */
  private readonly capacity: number

  constructor(x: number, y: number, roadAngle: number, extraCrossings = 0) {
    this.x = x
    this.y = y
    this.angle = roadAngle + Math.PI / 2
    this.capacity = SALT.crossings + extraCrossings
    this.left = this.capacity

    this.draw()
    this.gfx.addChild(this.grains)
    this.gfx.position.set(x, y)
    this.gfx.rotation = this.angle
  }

  get spent() {
    return this.left <= 0
  }

  get remaining() {
    return this.left
  }

  private draw() {
    const g = this.grains.clear()
    const L = SALT.length
    const wear = this.left / this.capacity

    // A poured line, not a painted one: scattered grains, thinning as it is used up.
    for (let i = 0; i < 90; i++) {
      const t = (i / 89 - 0.5) * L
      // The ends go first, because that is where they step around it.
      const edge = 1 - Math.abs(t) / (L / 2)
      if (Math.random() > wear * 0.65 + edge * 0.35) continue
      g.circle(t + (Math.random() - 0.5) * 6, (Math.random() - 0.5) * SALT.width, 0.9 + Math.random() * 1.4)
        .fill({ color: 0xe8eef0, alpha: 0.4 + Math.random() * 0.45 })
    }
  }

  contains(px: number, py: number): boolean {
    const dx = px - this.x
    const dy = py - this.y
    const cos = Math.cos(-this.angle)
    const sin = Math.sin(-this.angle)
    const lx = dx * cos - dy * sin
    const ly = dx * sin + dy * cos
    return Math.abs(lx) <= SALT.length / 2 && Math.abs(ly) <= SALT.width / 2
  }

  /**
   * Charges anything that steps over it, once. `crossed` is what makes it a *line* rather
   * than a strip: standing on salt costs nothing, crossing it costs everything.
   */
  update(enemies: Enemy[], lighting: LightingSystem, boost = 1): { x: number; y: number }[] {
    if (this.spent) return []

    const hits: { x: number; y: number }[] = []
    for (const e of enemies) {
      const on = this.contains(e.x, e.y)
      if (!on) {
        this.crossed.delete(e)
        continue
      }
      if (this.crossed.has(e)) continue
      this.crossed.add(e)

      if (e.applyDamage(SALT.damage * boost, 'salt', lighting, DARK_CAPABLE) > 0) {
        e.slowUntil = SALT.slowFor
        e.slowStrength = SALT.slow
        hits.push({ x: e.x, y: e.y })
        this.left -= 1
        this.draw()
        if (this.spent) break
      }
    }
    return hits
  }
}

/**
 * The Bottle Tree. Blue glass on bare branches — folklore says haints go in and cannot get
 * back out, and the sun takes them in the morning.
 *
 * Three bottles, one thing each. **Its damage is light-typed**, which is what finally makes
 * the Tallow Man's 50% light resist a live number rather than declared data; it has been
 * sitting inert in the roster since the counterplay pass waiting for exactly this ward.
 */
export class BottleTree {
  readonly gfx = new Container()
  readonly x: number
  readonly y: number

  /** Per bottle: what it holds and for how long, or the recharge if it is empty. */
  private bottles: { holding: Enemy | null; timer: number }[] = []
  private glass = new Graphics()

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
    for (let i = 0; i < BOTTLE_TREE.bottles; i++) this.bottles.push({ holding: null, timer: 0 })

    const trunk = new Graphics()
    trunk.ellipse(0, 1, 12, 4).fill({ color: 0x000000, alpha: 0.3 })
    trunk.moveTo(-3, 0).lineTo(-2, -34).lineTo(2, -34).lineTo(3, 0).fill(0x3b332a)
    // Bare branches, cut short so a bottle can be pushed onto each one.
    for (const [ex, ey] of [
      [-14, -40],
      [14, -42],
      [0, -50],
    ] as const) {
      trunk.moveTo(0, -28).quadraticCurveTo(ex * 0.5, -36, ex, ey).stroke({ width: 2.4, color: 0x3b332a, cap: 'round' })
    }

    this.gfx.addChild(trunk, this.glass)
    this.gfx.position.set(x, y)
  }

  private static readonly HOOKS = [
    { x: -14, y: -40 },
    { x: 14, y: -42 },
    { x: 0, y: -50 },
  ]

  contains(px: number, py: number): boolean {
    return Math.hypot(px - this.x, py - (this.y - 30)) < 30
  }

  get full() {
    return this.bottles.filter((b) => b.holding).length
  }

  update(dt: number, enemies: Enemy[], lighting: LightingSystem, boost = 1): { x: number; y: number }[] {
    const released: { x: number; y: number }[] = []

    for (const bottle of this.bottles) {
      bottle.timer = Math.max(0, bottle.timer - dt)

      if (bottle.holding) {
        // Keep it held wherever it was standing; the glass does not drag it anywhere.
        bottle.holding.frozen = Math.max(bottle.holding.frozen, 0.12)
        if (bottle.timer > 0) continue

        const caught = bottle.holding
        bottle.holding = null
        bottle.timer = BOTTLE_TREE.recharge
        caught.bottled = false
        // Light, so a Tallow Man shrugs half of it off. That is the counterplay working.
        if (caught.applyDamage(BOTTLE_TREE.damage * boost, 'light', lighting) > 0) {
          released.push({ x: caught.x, y: caught.y })
        }
        continue
      }

      if (bottle.timer > 0) continue

      for (const e of enemies) {
        if (e.bottled || e.dead) continue
        if (Math.hypot(e.x - this.x, e.y - this.y) > BOTTLE_TREE.radius) continue
        e.bottled = true
        bottle.holding = e
        bottle.timer = BOTTLE_TREE.holdFor
        break
      }
    }

    this.drawGlass()
    return released
  }

  private drawGlass() {
    const g = this.glass.clear()
    for (let i = 0; i < this.bottles.length; i++) {
      const hook = BottleTree.HOOKS[i]
      const bottle = this.bottles[i]
      const charged = bottle.holding !== null
      const empty = !charged && bottle.timer > 0

      // Body, neck, and — when something is in it — a pale shape turning inside.
      g.moveTo(hook.x - 4, hook.y)
        .quadraticCurveTo(hook.x - 5, hook.y + 11, hook.x, hook.y + 13)
        .quadraticCurveTo(hook.x + 5, hook.y + 11, hook.x + 4, hook.y)
        .lineTo(hook.x + 1.6, hook.y - 4)
        .lineTo(hook.x - 1.6, hook.y - 4)
        .fill({ color: charged ? 0x6fd8e8 : 0x2f6f8c, alpha: empty ? 0.25 : 0.7 })

      if (charged) {
        g.circle(hook.x, hook.y + 7, 2.6).fill({ color: 0xdff6ff, alpha: 0.65 })
      }
      g.moveTo(hook.x - 2.5, hook.y + 2)
        .quadraticCurveTo(hook.x - 3.4, hook.y + 8, hook.x - 1.4, hook.y + 11)
        .stroke({ width: 0.9, color: 0xd8f2ff, alpha: empty ? 0.15 : 0.45 })
    }
  }
}

/**
 * The Spring Line. Water off the hillside, let loose across the road.
 *
 * It hurts nothing and lights almost nothing. What it does is **refuse to be walked
 * through** — the dead go round — and **make a lantern standing in it worth 35% more**,
 * which §2.5 calls the game's central ward combo and is the entire reason it costs what a
 * lantern costs.
 *
 * It is also the one place in the game that is *good* for her. §3.3: she plays in it, and
 * she heals while she does.
 */
export class SpringLine {
  readonly gfx = new Container()
  readonly light: Light
  readonly x: number
  readonly y: number

  private surface = new Graphics()
  private t = Math.random() * 10
  /** §3.3: the barrier is wider while she is in it. */
  private boosted = false

  constructor(x: number, y: number, lighting: LightingSystem) {
    this.x = x
    this.y = y

    // §2.5: Dim on its own, never Lit. It is a hint of water, not a lamp.
    this.light = lighting.add({
      x,
      y,
      radius: SPRING.radius,
      color: 0x9fd8e0,
      intensity: SPRING.intensity,
    })

    this.gfx.addChild(this.surface)
    this.gfx.position.set(x, y)
  }

  /** What enemies path around. Wider while she is playing in it (§3.3). */
  get radius() {
    return SPRING.radius * (this.boosted ? SPRING.karaBoost : 1)
  }

  /** True when a point is close enough to the middle for her to be in Play (§3.3). */
  playZone(px: number, py: number): boolean {
    return Math.hypot(px - this.x, py - this.y) <= SPRING.radius * SPRING.playFraction
  }

  contains(px: number, py: number): boolean {
    return Math.hypot(px - this.x, py - this.y) <= SPRING.radius
  }

  /** §2.5: a lantern standing in the mist. Per-post, exactly as Lead is per-light. */
  boostsLantern(lx: number, ly: number): boolean {
    return Math.hypot(lx - this.x, ly - this.y) <= SPRING.radius
  }

  update(dt: number, karaPlaying: boolean) {
    this.boosted = karaPlaying
    this.t += dt

    // Running water: concentric ripples pushed outward, plus a spray where she is in it.
    const g = this.surface.clear()
    const r = this.radius

    g.circle(0, 0, r).fill({ color: 0x2b4a52, alpha: 0.18 })

    for (let i = 0; i < 4; i++) {
      const phase = (this.t * 0.35 + i * 0.25) % 1
      g.circle(0, 0, r * (0.25 + phase * 0.75)).stroke({
        width: 1.2,
        color: 0xbfe8f0,
        alpha: 0.22 * (1 - phase),
      })
    }

    // The channel itself, cutting across.
    for (let i = 0; i < 5; i++) {
      const y = -r * 0.55 + i * (r * 0.28)
      const wobble = Math.sin(this.t * 1.6 + i) * 5
      g.moveTo(-r * 0.9, y)
        .quadraticCurveTo(wobble, y + 6, r * 0.9, y)
        .stroke({ width: 1.4, color: 0x8fd0dc, alpha: 0.3 })
    }

    if (karaPlaying) {
      // She is attacking it, so it is attacking back.
      for (let i = 0; i < 9; i++) {
        const a = this.t * 5 + i * 0.7
        const d = (i / 9) * r * 0.7
        g.circle(Math.cos(a) * d, Math.sin(a) * d * 0.5, 1.4 + (i % 3)).fill({
          color: 0xdff4f8,
          alpha: 0.4,
        })
      }
    }
  }
}

/**
 * The Fiddler. A man on the porch who plays while the hollow comes down the road.
 *
 * He is the only ward that makes other wards better rather than doing anything himself,
 * which is why he was built last: a multiplier is only a choice once there is a roster
 * worth multiplying.
 *
 * **He flees.** Anything within 120px and the music stops. He is not a tower, he is a man,
 * and the aura is worth what it is worth precisely because he cannot be left out in front —
 * the best place for the music is never the best place for him.
 */
export class Fiddler {
  readonly gfx = new Container()
  readonly x: number
  readonly y: number

  readonly upgrades = new Upgradable()
  private stats: Omit<FiddlerTier, 'cost' | 'note'> = { ...FIDDLER_BASE }

  private body = new Container()
  private bowArm = new Container()
  private ring = new Graphics()
  private t = Math.random() * 6
  /** 1 playing, 0 gone. Eased, so the music does not snap off. */
  private playing = 1
  private clearFor = 0

  constructor(x: number, y: number) {
    this.x = x
    this.y = y

    const g = new Graphics()
    g.ellipse(0, 1, 9, 3).fill({ color: 0x000000, alpha: 0.3 })
    // A stool, and a man hunched over the instrument.
    g.rect(-7, -8, 3, 8).fill(0x3d3128)
    g.rect(4, -8, 3, 8).fill(0x3d3128)
    g.rect(-9, -11, 18, 3.5).fill(0x4a3d30)
    g.moveTo(-7, -11).quadraticCurveTo(-8, -26, -3, -30).lineTo(5, -30).quadraticCurveTo(9, -25, 7, -11).fill(0x5a4636)
    g.circle(1, -35, 6).fill(0x8a6b4e)
    // Hat brim, because everyone in this hollow has one.
    g.moveTo(-8, -37).quadraticCurveTo(1, -41, 10, -37).quadraticCurveTo(1, -34, -8, -37).fill(0x3d3128)
    // The fiddle, tucked under the chin.
    g.ellipse(9, -27, 5, 3.4).fill(0x7a3f26)
    g.moveTo(13, -28).lineTo(21, -30).stroke({ width: 1.2, color: 0x4a3d30 })

    this.bowArm.position.set(9, -27)
    this.bowArm.addChild(
      new Graphics().moveTo(-9, 0).lineTo(11, -3).stroke({ width: 1.4, color: 0xd8c9a8 }),
    )

    this.body.addChild(g, this.bowArm)
    this.gfx.addChild(this.ring, this.body)
    this.gfx.position.set(x, y)
  }

  get radius() {
    return this.stats.radius
  }

  /** 1 when he is not playing, so callers can multiply unconditionally. */
  get boost() {
    return 1 + (this.stats.boost - 1) * this.playing
  }

  get karaSpeed() {
    return 1 + (this.stats.karaSpeed - 1) * this.playing
  }

  get scared() {
    return this.playing < 0.5
  }

  contains(px: number, py: number): boolean {
    return Math.hypot(px - this.x, py - (this.y - 24)) < 28
  }

  upgrade(id: BranchId): number {
    const tier = this.upgrades.take(id) as FiddlerTier | null
    if (!tier) return 0
    this.stats = { radius: tier.radius, boost: tier.boost, karaSpeed: tier.karaSpeed }
    return tier.cost
  }

  /** `threat` is the distance to the nearest enemy. */
  update(dt: number, threat: number) {
    this.t += dt

    if (threat < FIDDLER.fleeRadius) this.clearFor = 0
    else this.clearFor += dt

    // Stops dead, starts again slowly. A man who has just been frightened does not pick
    // straight back up where he left off.
    const wants = this.clearFor >= FIDDLER.settle ? 1 : 0
    this.playing += (wants - this.playing) * Math.min(1, dt * (wants ? 1.2 : 9))

    // Bowing, and a shoulder that moves with it.
    this.bowArm.rotation = Math.sin(this.t * 7) * 0.34 * this.playing
    this.body.rotation = Math.sin(this.t * 3.5) * 0.03 * this.playing
    this.body.position.y = this.playing < 0.5 ? (1 - this.playing) * 6 : 0
    this.body.alpha = 0.35 + 0.65 * this.playing

    // The music, drawn as it travels: rings going out, fading as they go.
    const g = this.ring.clear()
    if (this.playing <= 0.02) return
    for (let i = 0; i < 3; i++) {
      const phase = (this.t * 0.4 + i / 3) % 1
      g.circle(0, -20, this.stats.radius * phase).stroke({
        width: 1,
        color: 0xd8c78a,
        alpha: 0.13 * (1 - phase) * this.playing,
      })
    }
  }
}

/**
 * The Church Bell. One per map, rung by hand, and the only ward that touches the whole
 * board at once.
 *
 * **It reveals and it stops. It does not kill.** Forcing everything to Dim makes it
 * visible and pointedly not damageable — the bell buys information and a held breath, and
 * you still have to have built something to spend them on.
 *
 * It also folds Kara's ears for three seconds. Ringing it costs the instrument you
 * normally read the dark with, which is the trade that stops it being a free button.
 */
export class ChurchBell {
  readonly gfx = new Container()
  readonly x: number
  readonly y: number

  private cooldown = 0
  private swing = 0
  private bellGfx = new Container()
  /** §7.2 scar 3, "Cracked bell frame": 45s → 70s for the rest of the run. */
  private period: number = CHURCH_BELL.cooldown

  setCooldown(seconds: number) {
    this.period = seconds
  }

  constructor(x: number, y: number) {
    this.x = x
    this.y = y

    const frame = new Graphics()
    frame.ellipse(0, 1, 14, 4).fill({ color: 0x000000, alpha: 0.32 })
    // A hanging frame: two posts and a crossbeam.
    frame.rect(-13, -44, 4, 44).fill(0x4a3d30)
    frame.rect(9, -44, 4, 44).fill(0x4a3d30)
    frame.rect(-15, -48, 30, 5).fill(0x3d3128)

    const bell = new Graphics()
    bell
      .moveTo(-8, -4)
      .quadraticCurveTo(-8, -20, 0, -22)
      .quadraticCurveTo(8, -20, 8, -4)
      .lineTo(-8, -4)
      .fill(0x8d7a4a)
    bell.rect(-9.5, -4, 19, 3).fill(0x7a6840)
    bell.circle(0, -1, 1.8).fill(0x5c4e30)
    bell.moveTo(-1.4, -24).lineTo(1.4, -24).lineTo(1.4, -22).lineTo(-1.4, -22).fill(0x5c4e30)
    this.bellGfx.position.set(0, -42)
    this.bellGfx.addChild(bell)

    this.gfx.addChild(frame, this.bellGfx)
    this.gfx.position.set(x, y)
  }

  get ready() {
    return this.cooldown <= 0
  }

  get cooldownRemaining() {
    return Math.max(0, this.cooldown)
  }

  contains(px: number, py: number): boolean {
    return Math.hypot(px - this.x, py - (this.y - 30)) < 32
  }

  /** Returns false if it is still cooling. */
  ring(): boolean {
    if (!this.ready) return false
    this.cooldown = this.period
    this.swing = 1
    return true
  }

  animate(dt: number) {
    this.cooldown = Math.max(0, this.cooldown - dt)
    this.swing = Math.max(0, this.swing - dt * 0.55)
    // Rings hard and settles slowly, which is the only animation it needs.
    this.bellGfx.rotation = Math.sin(this.swing * 34) * 0.5 * this.swing * this.swing
  }
}

/**
 * Cold Iron: a board of square-cut nails laid lengthwise along the road bed.
 *
 * It ticks against everything standing on it — but only what the light has made
 * damageable takes the bite. Laying iron in the dark is legal on purpose: it is an
 * investment waiting for a lantern, which is exactly the reveal/kill split the
 * design wants the player thinking about.
 */
export class ColdIron {
  readonly gfx = new Container()
  readonly x: number
  readonly y: number
  /** Radians; snapped to the nearest road segment at placement. */
  readonly angle: number

  readonly upgrades = new Upgradable()
  private stats: Omit<IronTier, 'cost' | 'note'> = { ...IRON_BASE }

  private cooldown = 0
  private board = new Graphics()
  private glints = new Graphics()

  constructor(x: number, y: number, angle: number) {
    this.x = x
    this.y = y
    this.angle = angle

    this.draw()
    this.gfx.addChild(this.board, this.glints)
    this.gfx.position.set(x, y)
    this.gfx.rotation = angle
  }

  /** Redrawn on every upgrade, because Rail Iron changes the strip's actual length. */
  private draw() {
    const L = this.stats.length
    const W = COLD_IRON.width
    const branch = this.upgrades.branch
    const tier = this.upgrades.tier

    const g = this.board.clear()
    // Shadow, then weathered board, then the nail heads in two staggered rows.
    g.roundRect(-L / 2, -W / 2 + 2, L, W, 4).fill({ color: 0x000000, alpha: 0.28 })
    g.roundRect(-L / 2, -W / 2, L, W - 3, 4).fill(branch === 'graveyard' ? 0x2b2a2c : 0x3a332b)
    g.roundRect(-L / 2 + 2, -W / 2 + 2, L - 4, 4, 2).fill({ color: 0x474034, alpha: 0.8 })

    // Rail Iron lays ties across the board before the nails go in.
    if (branch === 'rail') {
      for (let i = 0; i < 4 + tier; i++) {
        const tx = -L / 2 + 10 + i * ((L - 20) / (3 + tier))
        g.rect(tx - 2.5, -W / 2 + 1, 5, W - 5).fill({ color: 0x2f2a22, alpha: 0.8 })
      }
      g.rect(-L / 2 + 4, -7, L - 8, 2).fill({ color: 0x6c757d, alpha: 0.75 })
      if (tier > 1) g.rect(-L / 2 + 4, 4, L - 8, 2).fill({ color: 0x6c757d, alpha: 0.75 })
    }

    const nails = Math.max(9, Math.round(L / 10))
    const head = branch === 'graveyard' ? 0x9aa6a0 : 0x8d949c
    for (let i = 0; i < nails; i++) {
      const nx = -L / 2 + 8 + i * ((L - 16) / (nails - 1))
      const size = branch === 'graveyard' ? 3.4 + tier * 0.3 : 2.8
      g.rect(nx - size / 2, -6, size, size).fill(head)
      g.rect(nx - size / 2 + 4, 3, size, size).fill(branch === 'graveyard' ? 0x818d88 : 0x7a828b)
    }

    // Graveyard Iron's second tier bites things that are merely visible, so it carries
    // its own corpse-light — the one cue that this strip does not obey the light rule.
    if (branch === 'graveyard' && tier > 1) {
      for (let i = 0; i < nails; i++) {
        const nx = -L / 2 + 8 + i * ((L - 16) / (nails - 1))
        g.circle(nx, -4.5, 3.2).fill({ color: 0x8fd8c0, alpha: 0.16 })
      }
    }
  }

  /** True if a world point stands on the strip. Public — the player clicks it too. */
  contains(px: number, py: number): boolean {
    const dx = px - this.x
    const dy = py - this.y
    const cos = Math.cos(-this.angle)
    const sin = Math.sin(-this.angle)
    const lx = dx * cos - dy * sin
    const ly = dx * sin + dy * cos
    return Math.abs(lx) <= this.stats.length / 2 && Math.abs(ly) <= COLD_IRON.width / 2
  }

  get length() {
    return this.stats.length
  }

  /** Buy the next tier. Returns its cost, or 0 if nothing was bought. */
  upgrade(id: BranchId): number {
    const tier = this.upgrades.take(id) as IronTier | null
    if (!tier) return 0

    this.stats = {
      length: tier.length,
      tickDamage: tier.tickDamage,
      slow: tier.slow,
      threshold: tier.threshold,
    }
    this.draw()
    return tier.cost
  }

  /** Returns the positions of everything it bit this tick, for the ember burst. */
  update(dt: number, enemies: Enemy[], lighting: LightingSystem, boost = 1): { x: number; y: number }[] {
    this.cooldown -= dt
    this.glints.clear()

    // The slow is applied every frame even though damage is not: a 0.4s tick would make
    // it stutter, and Rail Iron's whole point is that the slow compounds with the dwell.
    if (this.stats.slow < 1) {
      for (const e of enemies) {
        if (this.contains(e.x, e.y)) e.slowFactor = Math.min(e.slowFactor, this.stats.slow)
      }
    }

    if (this.cooldown > 0) return []
    this.cooldown = COLD_IRON.tickInterval

    const hits: { x: number; y: number }[] = []
    for (const w of enemies) {
      if (!this.contains(w.x, w.y)) continue
      // Iron, specifically — the counterplay matrix is built on the type, not the ward.
      if (w.applyDamage(this.stats.tickDamage * boost, 'iron', lighting, this.stats.threshold) > 0) {
        hits.push({ x: w.x, y: w.y })
        // The nails glint where they bite.
        const lx = (Math.random() - 0.5) * this.stats.length * 0.8
        this.glints.rect(lx, -5 + Math.random() * 10, 3, 3).fill({ color: 0xd8e2ea, alpha: 0.9 })
      }
    }
    return hits
  }
}
