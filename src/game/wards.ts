import { Container, Graphics } from 'pixi.js'
import type { Haint } from './enemies'
import type { Light, LightingSystem } from './lighting'

/**
 * Wards, not guns. Nothing here shoots — a lantern makes a stretch of road real
 * enough to be fought in, and the salt and the bell do the rest.
 */
export interface WardKind {
  id: string
  name: string
  cost: number
  hint: string
}

export const WARDS: Record<string, WardKind> = {
  lantern: {
    id: 'lantern',
    name: 'Lantern Post',
    cost: 30,
    hint: 'Lights a stretch of road and burns what stands in it.',
  },
  hose: {
    id: 'hose',
    name: 'Spring Line',
    cost: 55,
    hint: 'Running water. Spirits will not cross it — and Kara cannot leave it alone.',
  },
}

const LANTERN_AMBER = 0xffc078

export class Lantern {
  readonly light: Light
  readonly gfx = new Graphics()
  private cooldown = 0

  readonly damage = 14
  readonly fireRate = 0.55

  readonly x: number
  readonly y: number

  constructor(x: number, y: number, lighting: LightingSystem) {
    this.x = x
    this.y = y
    this.light = lighting.add({
      x,
      y,
      radius: 150,
      color: LANTERN_AMBER,
      intensity: 0.85,
      flicker: 0.06,
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

  update(dt: number, haints: Haint[], lighting: LightingSystem) {
    this.cooldown -= dt
    if (this.cooldown > 0) return

    for (const h of haints) {
      const d = Math.hypot(h.x - this.x, h.y - this.y)
      if (d > this.light.radius) continue
      // damage() refuses if the target is standing in the dark.
      if (h.damage(this.damage, lighting)) {
        this.cooldown = this.fireRate
        break
      }
    }
  }
}

/**
 * The spring line. Real Appalachian folk belief: spirits cannot cross running water.
 *
 * Two things make this Kara's ability and not just another tower — the mist refracts
 * lantern light into a glowing curtain, and she cannot resist biting at the spray.
 * While she plays in it, output is amplified and she is healed. The catch is she
 * will not leave on her own.
 */
export class SpringLine {
  readonly light: Light
  readonly gfx = new Graphics()
  readonly mist = new Container()
  readonly radius = 110

  /** Set by the game when Kara is in the water. */
  amplified = false

  private droplets: { x: number; y: number; life: number }[] = []
  private spawn = 0

  readonly x: number
  readonly y: number

  constructor(x: number, y: number, lighting: LightingSystem) {
    this.x = x
    this.y = y
    // The spray itself is a weak light — the mist is catching the lanterns, not glowing.
    this.light = lighting.add({ x, y, radius: this.radius, color: 0xa8d8ff, intensity: 0.35 })

    this.gfx
      .circle(0, 0, 10)
      .fill(0x4a5a52)
      .circle(0, 0, this.radius)
      .stroke({ width: 1.5, color: 0x8fd8ff, alpha: 0.35 })
    this.gfx.position.set(x, y)
    this.mist.position.set(x, y)
  }

  /** Enemies path around running water rather than through it. */
  repels(px: number, py: number) {
    return Math.hypot(px - this.x, py - this.y) < this.radius
  }

  update(dt: number) {
    this.light.intensity = this.amplified ? 0.6 : 0.35
    this.light.radius = this.amplified ? this.radius * 1.35 : this.radius

    this.spawn -= dt
    if (this.spawn <= 0) {
      this.spawn = this.amplified ? 0.015 : 0.04
      const angle = Math.random() * Math.PI * 2
      this.droplets.push({ x: Math.cos(angle) * 6, y: Math.sin(angle) * 6, life: 1 })
    }

    this.mist.removeChildren()
    for (const d of this.droplets) {
      d.life -= dt * 1.4
      const spread = (1 - d.life) * this.radius
      const angle = Math.atan2(d.y, d.x)
      const px = Math.cos(angle) * spread
      const py = Math.sin(angle) * spread
      const dot = new Graphics().circle(px, py, 1.6).fill({ color: 0xd8f0ff, alpha: d.life * 0.5 })
      this.mist.addChild(dot)
    }
    this.droplets = this.droplets.filter((d) => d.life > 0)
  }
}

/** Bubbles. She chases them without hesitation, and each one drags a little light with it. */
export class Bubble {
  readonly light: Light
  readonly gfx = new Graphics()
  life = 4

  x: number
  y: number

  constructor(x: number, y: number, lighting: LightingSystem) {
    this.x = x
    this.y = y
    this.light = lighting.add({ x, y, radius: 46, color: 0xcfe8ff, intensity: 0.3 })
    this.gfx
      .circle(0, 0, 7)
      .stroke({ width: 1.5, color: 0xe8f6ff, alpha: 0.8 })
      .circle(-2, -2, 2)
      .fill({ color: 0xffffff, alpha: 0.7 })
  }

  update(dt: number) {
    this.life -= dt
    this.y -= 12 * dt
    this.x += Math.sin(this.life * 3) * 10 * dt
    this.light.x = this.x
    this.light.y = this.y
    this.light.intensity = 0.3 * Math.max(0, Math.min(1, this.life))
    this.gfx.position.set(this.x, this.y)
    this.gfx.alpha = Math.max(0, Math.min(1, this.life))
  }

  get popped() {
    return this.life <= 0
  }
}
