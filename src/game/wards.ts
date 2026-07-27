import { Graphics } from 'pixi.js'
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
  readonly gfx = new Graphics()
  readonly x: number
  readonly y: number

  private cooldown = 0

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

    this.gfx
      .moveTo(0, 0)
      .lineTo(0, -26)
      .stroke({ width: 3, color: 0x3d3128 })
      .roundRect(-6, -36, 12, 14, 3)
      .fill(0x6b5744)
      .circle(0, -29, 3.5)
      .fill(0xffe0a8)
    this.gfx.position.set(x, y)
  }

  /** Returns the damage dealt this tick, so the caller can award oil on a kill. */
  update(dt: number, walkers: RoadWalker[], lighting: LightingSystem) {
    this.cooldown -= dt
    if (this.cooldown > 0) return

    // Fire on the target furthest along the road that is actually damageable.
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

    if (!best) return

    best.applyDamage(LANTERN.damage, lighting)
    this.cooldown = LANTERN.fireInterval
  }
}
