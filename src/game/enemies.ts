import { Graphics } from 'pixi.js'
import { BAND_DIM, PORCH_DAMAGE, ROAD_WALKER } from './balance'
import { damageMultiplier } from './lighting'
import type { LightingSystem } from './lighting'
import { ROAD } from './world'
import type { Vec2 } from './world'

/**
 * The Road Walker. design-doc §6: "Baseline. Walks the road toward the homestead."
 *
 * The only enemy that exists so far. The rest of the roster is specified in the doc
 * but not implemented — do not add them ahead of the build order in §13.
 */
export class RoadWalker {
  x: number
  y: number
  hp: number = ROAD_WALKER.hp

  readonly porchDamage = PORCH_DAMAGE.roadWalker
  readonly gfx = new Graphics()

  /** Index into ROAD plus the fraction travelled into the current segment. */
  private t = 0
  private wobble = Math.random() * Math.PI * 2
  private path: Vec2[] = ROAD

  constructor() {
    this.x = this.path[0].x
    this.y = this.path[0].y

    const { radius, color } = ROAD_WALKER
    this.gfx
      .ellipse(0, radius * 0.5, radius * 0.9, radius * 0.4)
      .fill({ color: 0x000000, alpha: 0.25 })
      .circle(0, 0, radius)
      .fill({ color, alpha: 0.75 })
      .circle(0, 0, radius * 0.55)
      .fill({ color: 0xffffff, alpha: 0.12 })
  }

  get dead() {
    return this.hp <= 0
  }

  /** True once it has walked onto the porch. */
  get arrived() {
    return this.t >= this.path.length - 1
  }

  /**
   * §2.1: wards cannot hurt what is standing in the dark, and the bright band pays a
   * bonus. Returns the damage actually dealt, which is zero below the lit threshold.
   */
  applyDamage(amount: number, lighting: LightingSystem): number {
    const multiplier = damageMultiplier(lighting.bandAt(this.x, this.y))
    if (multiplier === 0) return 0

    const dealt = amount * multiplier
    this.hp -= dealt
    return dealt
  }

  /** Whether a ward may currently target it. Mirrors the damage gate. */
  targetable(lighting: LightingSystem): boolean {
    return damageMultiplier(lighting.bandAt(this.x, this.y)) > 0
  }

  update(dt: number, lighting: LightingSystem) {
    const segment = Math.min(Math.floor(this.t), this.path.length - 2)
    const from = this.path[segment]
    const to = this.path[segment + 1]
    const segLength = Math.hypot(to.x - from.x, to.y - from.y) || 1

    this.t = Math.min(this.path.length - 1, this.t + (ROAD_WALKER.speed * dt) / segLength)

    const frac = this.t - segment
    this.x = from.x + (to.x - from.x) * frac
    this.y = from.y + (to.y - from.y) * frac

    // Drift, so they do not read as beads on a wire.
    this.wobble += dt * 1.7
    this.x += Math.sin(this.wobble) * 9

    // §2.1: in the dark band an enemy is invisible, full stop. This is the rule the
    // whole game is built on, and it has to be literal or none of it lands.
    const L = lighting.lightAt(this.x, this.y)
    this.gfx.alpha = L < BAND_DIM ? 0 : 0.5 + 0.5 * Math.min(1, (L - BAND_DIM) / 0.4)
    this.gfx.position.set(this.x, this.y)
    this.gfx.scale.set(1 - (1 - this.hp / ROAD_WALKER.hp) * 0.15)
  }
}
