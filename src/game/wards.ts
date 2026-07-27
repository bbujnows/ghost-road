import { Container, Graphics } from 'pixi.js'
import { LANTERN } from './balance'
import type { Light, LightingSystem } from './lighting'
import type { RoadWalker } from './enemies'

/**
 * Lantern Post. design-doc §5.
 *
 * Wards are not guns — the lantern's primary job is making a stretch of road real
 * enough to be fought in. The damage is secondary and only lands on something already
 * standing in its own light.
 *
 * Salt lines, the church bell, the fiddler, and the spring line are all specified in
 * §5 but not built. Build order is §13.
 */
export class Lantern {
  readonly light: Light
  readonly gfx = new Container()
  /** The flame itself, drawn above the darkness overlay and fed into the bloom. */
  readonly emissive = new Container()
  readonly x: number
  readonly y: number

  // Never fires the instant a target lights up. See LANTERN.initialDelay.
  private cooldown: number = LANTERN.initialDelay
  private hadTarget = false
  private housing = new Container()
  private flame = new Graphics()
  private sway = Math.random() * Math.PI * 2

  constructor(x: number, y: number, lighting: LightingSystem) {
    this.x = x
    this.y = y

    this.light = lighting.add({
      x,
      y,
      radius: LANTERN.radius,
      color: LANTERN.color,
      intensity: LANTERN.intensity,
      flicker: LANTERN.flicker,
    })

    // A post driven into the roadside, with a hooked arm and a hung lamp.
    const post = new Graphics()
    post.ellipse(0, 0, 9, 3.5).fill({ color: 0x000000, alpha: 0.3 })
    post.moveTo(-2, 0).lineTo(-2.5, -40).lineTo(2.5, -40).lineTo(2, 0).fill(0x4a3d30)
    post.moveTo(-1, -34).lineTo(-1, -38).lineTo(11, -38).lineTo(11, -35).fill(0x3d3128)
    // Bracing stones at the foot.
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
    this.housing.addChild(lamp)

    this.gfx.addChild(post, this.housing)
    this.gfx.position.set(x, y)

    // The flame reads through the darkness, the way the homestead's windows do.
    this.flame.ellipse(0, -6, 3, 5).fill({ color: 0xfff0cc, alpha: 0.95 })
    this.flame.ellipse(0, -6, 6, 9).fill({ color: 0xffc078, alpha: 0.35 })
    this.emissive.position.set(x + 10, y - 36)
    this.emissive.addChild(this.flame)
  }

  /** Called every frame, including while a wave is between spawns. */
  animate(dt: number) {
    this.sway += dt * 2.4
    // The lamp swings a little on its hook; the flame lags behind it.
    this.housing.rotation = Math.sin(this.sway) * 0.045
    this.flame.scale.set(1 + Math.sin(this.sway * 3.1) * 0.09, 1 + Math.sin(this.sway * 2.3) * 0.13)
    this.flame.position.x = Math.sin(this.sway) * 1.2
  }

  update(dt: number, walkers: RoadWalker[], lighting: LightingSystem): { x: number; y: number } | undefined {
    // Clamped at zero. Left to run negative while idle, the lantern banks readiness
    // and lands a free shot the instant anything crosses into its light.
    this.cooldown = Math.max(0, this.cooldown - dt)

    // Fire on the nearest target that is actually damageable.
    let best: RoadWalker | null = null
    let bestDist = Infinity

    for (const w of walkers) {
      const d = Math.hypot(w.x - this.x, w.y - this.y)
      if (d > LANTERN.radius) continue
      if (!w.targetable(lighting)) continue
      if (d < bestDist) {
        bestDist = d
        best = w
      }
    }

    // Re-arming on acquisition is what actually stops the alpha strike: two
    // overlapping lanterns can no longer both fire on the frame a walker lights up.
    if (!best) {
      this.hadTarget = false
      return
    }
    if (!this.hadTarget) {
      this.hadTarget = true
      this.cooldown = Math.max(this.cooldown, LANTERN.initialDelay)
      return
    }

    if (this.cooldown > 0) return

    best.applyDamage(LANTERN.damage, lighting)
    this.cooldown = LANTERN.fireInterval
    // Where the hit landed, so the game can throw embers off it.
    return { x: best.x, y: best.y }
  }
}
