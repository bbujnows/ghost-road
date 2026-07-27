import { Container, Graphics } from 'pixi.js'
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

  /**
   * A hunched figure in rags rather than a dot. Everything about it is built to read
   * at a glance in half-light: a bowed silhouette, a slow sway, and a hem that trails.
   * It has no face — whatever is under the hood is the player's problem to imagine.
   */
  readonly gfx = new Container()

  /** Index into ROAD plus the fraction travelled into the current segment. */
  private t = 0
  private wobble = Math.random() * Math.PI * 2
  private path: Vec2[] = ROAD

  private readonly shadow = new Graphics()
  private readonly frame = new Container()
  private readonly hem = new Graphics()
  private readonly armNear = new Container()
  private readonly armFar = new Container()
  private gait = Math.random() * Math.PI * 2

  constructor() {
    this.x = this.path[0].x
    this.y = this.path[0].y
    this.draw()
  }

  private draw() {
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
    // Shoulders hunched forward.
    robe.ellipse(0, -H + 7, 8, 5.5).fill({ color, alpha: 0.9 })
    // The hood, and the nothing inside it.
    robe.ellipse(1, -H + 1, 6.5, 7).fill({ color: dark, alpha: 0.95 })
    robe.ellipse(2, -H + 2, 4.5, 5).fill({ color: 0x101820, alpha: 0.9 })

    // Tattered hem, animated so it drags.
    this.hem.position.set(0, -4)

    // Near arm, hanging.
    this.armNear.position.set(3, -H + 12)
    this.armNear.addChild(new Graphics().roundRect(-2, 0, 4.5, 16, 2).fill({ color, alpha: 0.9 }))

    this.frame.addChild(this.armFar, robe, this.hem, this.armNear)
    this.gfx.addChild(this.shadow, this.frame)
  }

  private poseHem(t: number) {
    this.hem.clear()
    const { color } = ROAD_WALKER
    for (let i = 0; i < 5; i++) {
      const x = -10 + i * 5
      const sway = Math.sin(t * 2 + i * 0.9) * 1.6
      this.hem
        .moveTo(x, 0)
        .lineTo(x + sway, 4 + (i % 2 ? 3 : 1))
        .lineTo(x + 4, 0)
        .fill({ color, alpha: 0.7 })
    }
  }

  get dead() {
    return this.hp <= 0
  }

  /** True once it has walked onto the porch. */
  get arrived() {
    return this.t >= this.path.length - 1
  }

  /**
   * Where it will be after `seconds` of walking, following the road rather than a
   * straight line. Kara's Ear-Perk needs this: she tells the player about a threat
   * before it becomes visible, which means asking where it is about to be.
   */
  futurePosition(seconds: number): Vec2 {
    let t = this.t
    let remaining = ROAD_WALKER.speed * seconds

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
   * §2.1: wards cannot hurt what is standing in the dark, and the bright band pays a
   * bonus. Returns the damage actually dealt, which is zero below the lit threshold.
   */
  applyDamage(amount: number, lighting: LightingSystem): number {
    const multiplier = damageMultiplier(lighting.bandAt(this.x, this.y))
    if (multiplier === 0) return 0

    const dealt = amount * multiplier
    this.hp -= dealt
    this.hitFlash = 0.09
    return dealt
  }

  private hitFlash = 0

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

    // A slow, wrong walk. It sways rather than strides, and never quite finds a rhythm.
    this.gait += dt * 3.2
    this.frame.rotation = Math.sin(this.gait) * 0.055
    this.frame.position.y = Math.abs(Math.sin(this.gait)) * -1.4
    this.armNear.rotation = Math.sin(this.gait) * 0.35
    this.armFar.rotation = -Math.sin(this.gait) * 0.3
    this.poseHem(this.gait)

    // Face the way it is going, without ever turning to look at you.
    const heading = to.x - from.x
    if (Math.abs(heading) > 0.5) this.frame.scale.x = heading > 0 ? 1 : -1

    // §2.1: in the dark band an enemy is invisible, full stop. This is the rule the
    // whole game is built on, and it has to be literal or none of it lands.
    const L = lighting.lightAt(this.x, this.y)
    this.gfx.alpha = L < BAND_DIM ? 0 : 0.5 + 0.5 * Math.min(1, (L - BAND_DIM) / 0.4)
    this.gfx.position.set(this.x, this.y)

    // Wounded things stoop.
    const wear = 1 - this.hp / ROAD_WALKER.hp
    this.frame.scale.y = 1 - wear * 0.12

    // Hit feedback: a scorch flash and a flinch. Tint multiplies, so the flash pushes
    // the blue-grey robe toward burnt amber rather than brightening it.
    this.hitFlash = Math.max(0, this.hitFlash - dt)
    if (this.hitFlash > 0) {
      this.frame.tint = 0xffc9a0
      this.frame.scale.x *= 1.05
      this.frame.scale.y *= 0.96
    } else {
      this.frame.tint = 0xffffff
    }
  }
}

/**
 * What is left when a walker goes down.
 *
 * It inherits the walker's own display container, so it falls from exactly the pose it
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
    return this.t >= ROAD_WALKER.deathDuration
  }

  update(dt: number) {
    this.t = Math.min(ROAD_WALKER.deathDuration, this.t + dt)
    const k = this.t / ROAD_WALKER.deathDuration

    // Buckles first, then goes over. Ease-out so the fall has some weight to it.
    const fall = 1 - Math.pow(1 - k, 2.2)
    this.gfx.rotation = fall * 1.25
    this.gfx.scale.set(1, 1 - fall * 0.45)
    // Holds its shape for a beat, then goes to nothing.
    this.gfx.alpha = this.startAlpha * (k < 0.3 ? 1 : Math.max(0, 1 - (k - 0.3) / 0.7))
  }
}
