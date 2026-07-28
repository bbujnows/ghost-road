import { Container, Graphics } from 'pixi.js'
import { BRANCHES, COLD_IRON, IRON_BASE, LANTERN, LANTERN_BASE } from './balance'
import type { BranchId, IronTier, LanternTier } from './balance'
import type { Light, LightingSystem } from './lighting'
import type { Enemy } from './enemies'

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

  private housing = new Container()
  private flame = new Graphics()
  private fittings = new Graphics()
  private sway = Math.random() * Math.PI * 2

  /** Seconds left in the dark. The Tallow Man puts this on the clock. */
  private out = 0
  /** Eased 1 → 0 as the flame dies, so nothing snaps off. */
  private burn = 1
  private smoke = new Graphics()

  constructor(x: number, y: number, roadAngle: number, lighting: LightingSystem) {
    this.x = x
    this.y = y
    this.roadAngle = roadAngle

    this.light = lighting.add({
      x,
      y,
      radius: LANTERN.radius,
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
    this.emissive.addChild(this.flame, this.smoke)
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

    this.stats = {
      radius: tier.radius,
      along: tier.along,
      across: tier.across,
      snuffScale: tier.snuffScale,
    }

    this.light.radius = tier.radius * tier.along
    // A circle stays a circle: leaving radiusY undefined keeps it on the cheaper path.
    this.light.radiusY = tier.across === tier.along ? undefined : tier.radius * tier.across

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

  /** Called every frame, including while a wave is between spawns. */
  animate(dt: number) {
    this.sway += dt * 2.4
    this.housing.rotation = Math.sin(this.sway) * 0.045

    // Dies fast, comes back slowly — a pinched wick goes out at once, and relighting is
    // the lantern catching again rather than a switch being thrown.
    this.out = Math.max(0, this.out - dt)
    const want = this.out > 0 ? 0 : 1
    this.burn += (want - this.burn) * Math.min(1, dt * (want === 0 ? 14 : 2.6))

    this.light.intensity = LANTERN.intensity * this.burn

    const flicker = 1 + Math.sin(this.sway * 3.1) * 0.09
    this.flame.scale.set(this.burn * flicker, this.burn * (1 + Math.sin(this.sway * 2.3) * 0.13))
    this.flame.position.x = Math.sin(this.sway) * 1.2
    this.flame.alpha = this.burn

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
  update(dt: number, enemies: Enemy[], lighting: LightingSystem): { x: number; y: number }[] {
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
      if (w.applyDamage(this.stats.tickDamage, 'iron', lighting, this.stats.threshold) > 0) {
        hits.push({ x: w.x, y: w.y })
        // The nails glint where they bite.
        const lx = (Math.random() - 0.5) * this.stats.length * 0.8
        this.glints.rect(lx, -5 + Math.random() * 10, 3, 3).fill({ color: 0xd8e2ea, alpha: 0.9 })
      }
    }
    return hits
  }
}
