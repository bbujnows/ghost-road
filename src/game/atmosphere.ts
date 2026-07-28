import { BlurFilter, Container, Graphics, RenderTexture, Sprite, Texture } from 'pixi.js'
import type { Renderer } from 'pixi.js'

/**
 * The passes that sit on top of the world: bloom, drifting motes, and a vignette.
 *
 * None of it touches gameplay. It exists because a game about light needs its light
 * to behave like light — to spill past its source and hang in the air.
 */

/**
 * Bloom.
 *
 * The emissive layer (window glow, lantern flames, Kara's white) is rendered into a
 * texture, then drawn twice: once sharp, once blurred and additive. That second copy
 * is what makes a lantern feel hot rather than merely bright.
 */
export class Bloom {
  /** Put the things that should glow in here. */
  readonly source = new Container()
  /** Add this to the stage where the glow should land. */
  readonly output = new Container()

  private texture: RenderTexture
  private sharp: Sprite
  private glow: Sprite

  constructor(width: number, height: number) {
    // Full resolution. A half-res texture would soften the sharp copy, and the sharp
    // copy includes Kara's white markings — the one thing that must never go mushy.
    this.texture = RenderTexture.create({ width, height })

    this.sharp = new Sprite(this.texture)

    this.glow = new Sprite(this.texture)
    this.glow.blendMode = 'add'
    this.glow.alpha = 0.55
    this.glow.filters = [new BlurFilter({ strength: 14, quality: 4 })]

    this.output.addChild(this.sharp, this.glow)
  }

  update(renderer: Renderer) {
    renderer.render({ container: this.source, target: this.texture, clear: true })
  }

  destroy() {
    this.texture.destroy(true)
    this.output.destroy({ children: true })
  }
}

/**
 * Motes drifting through the hollow — pollen, ash, whatever the wind carries. They
 * brighten inside light and vanish outside it, so they double as a soft hint about
 * where the lit ground actually is.
 */
export class Motes {
  readonly container = new Container()

  private motes: { x: number; y: number; vx: number; vy: number; size: number; phase: number }[] = []
  private gfx = new Graphics()
  private width: number
  private height: number

  constructor(width: number, height: number, count = 90) {
    this.width = width
    this.height = height
    this.container.addChild(this.gfx)

    for (let i = 0; i < count; i++) {
      this.motes.push({
        x: Math.random() * width,
        y: 200 + Math.random() * (height - 200),
        vx: 4 + Math.random() * 10,
        vy: -2 - Math.random() * 5,
        size: 0.7 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
      })
    }
  }

  update(dt: number, lightAt: (x: number, y: number) => number) {
    this.gfx.clear()

    for (const m of this.motes) {
      m.phase += dt * 1.5
      m.x += (m.vx + Math.sin(m.phase) * 5) * dt
      m.y += m.vy * dt

      if (m.x > this.width + 10) m.x = -10
      if (m.y < 180) {
        m.y = this.height
        m.x = Math.random() * this.width
      }

      // Only visible where there is light to catch them.
      const lit = lightAt(m.x, m.y)
      if (lit < 0.2) continue

      this.gfx
        .circle(m.x, m.y, m.size)
        .fill({ color: 0xffe6bd, alpha: Math.min(0.5, (lit - 0.2) * 0.9) })
    }
  }
}

/**
 * Fog and wind (§6, nights 3+).
 *
 * The mechanical fog lives in the lightmap, where it shrinks every radius. This is only
 * the picture of it — banks of it drifting across the hollow — but it has to be here,
 * because a night where the lanterns quietly cover half as much road and nothing on
 * screen explains why is a night that reads as a bug.
 *
 * A gust runs a hard streak across the board a beat before the lanterns go out, so the
 * player sees the cause and not just the effect.
 */
export class Weather {
  readonly container = new Container()

  private banks: { x: number; y: number; w: number; h: number; v: number; a: number }[] = []
  private gfx = new Graphics()
  private gustGfx = new Graphics()
  private width: number
  /** Seconds left in the visible sweep of a gust. */
  private gust = 0
  private gustX = 0
  private density = 0

  constructor(width: number, height: number, count = 14) {
    this.width = width
    this.container.addChild(this.gfx, this.gustGfx)

    for (let i = 0; i < count; i++) {
      this.banks.push({
        x: Math.random() * width,
        y: 150 + Math.random() * (height - 150),
        w: 180 + Math.random() * 260,
        h: 26 + Math.random() * 48,
        v: 6 + Math.random() * 14,
        a: 0.4 + Math.random() * 0.6,
      })
    }
  }

  /** Called when the wind actually takes the lanterns. */
  blow() {
    this.gust = 1.1
    this.gustX = -160
  }

  update(dt: number, density: number) {
    this.density += (density - this.density) * Math.min(1, dt * 2)

    this.gfx.clear()
    if (this.density > 0.01) {
      for (const b of this.banks) {
        b.x += b.v * dt * (1 + this.gust * 6)
        if (b.x - b.w > this.width) b.x = -b.w
        this.gfx
          .ellipse(b.x, b.y, b.w / 2, b.h / 2)
          .fill({ color: 0x8ea3ad, alpha: 0.05 * b.a * this.density })
      }
    }

    this.gustGfx.clear()
    if (this.gust <= 0) return

    this.gust = Math.max(0, this.gust - dt)
    this.gustX += dt * 1900

    // Streaks of driven air, brightest at the leading edge.
    for (let i = 0; i < 22; i++) {
      const y = 120 + ((i * 97) % 560)
      const x = this.gustX - (i % 5) * 60
      this.gustGfx
        .moveTo(x, y)
        .lineTo(x - 70 - (i % 4) * 30, y + 6)
        .stroke({ width: 1.4, color: 0xd8e6ea, alpha: 0.16 * this.gust })
    }
  }
}

/**
 * Hit and kill feedback. Analog, not arithmetic — the consult doc's call, and the
 * horror tone agrees: no damage numbers, just embers and light.
 */
export class Sparks {
  /** Add to the bloom source so everything here glows. */
  readonly gfx = new Graphics()

  private embers: { x: number; y: number; vx: number; vy: number; life: number }[] = []
  private wisps: { x: number; y: number; sx: number; sy: number; cx: number; cy: number; t: number }[] = []
  private readonly target: { x: number; y: number }

  /** `target` is where kill-wisps fly — roughly under the HUD's oil counter. */
  constructor(target: { x: number; y: number }) {
    this.target = target
  }

  /** A lantern tick landing: a small burst of embers off the thing that was hit. */
  burst(x: number, y: number) {
    if (this.embers.length > 120) return
    const n = 4 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const speed = 18 + Math.random() * 32
      this.embers.push({
        x,
        y: y - 14,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 24,
        life: 0.5 + Math.random() * 0.3,
      })
    }
  }

  /** A kill paying out: one mote of lamplight arcs to the oil counter. */
  wisp(x: number, y: number) {
    if (this.wisps.length > 20) return
    this.wisps.push({
      x,
      y,
      sx: x,
      sy: y,
      // Control point bows the path upward so the arc reads as a throw, not a beeline.
      cx: (x + this.target.x) / 2 + (Math.random() - 0.5) * 120,
      cy: Math.min(y, this.target.y) - 120 - Math.random() * 60,
      t: 0,
    })
  }

  update(dt: number) {
    this.gfx.clear()

    for (const e of this.embers) {
      e.life -= dt
      e.x += e.vx * dt
      e.y += e.vy * dt
      e.vy += 30 * dt
      this.gfx.circle(e.x, e.y, 1.3 + e.life).fill({ color: 0xffb060, alpha: Math.max(0, e.life) })
    }
    this.embers = this.embers.filter((e) => e.life > 0)

    for (const w of this.wisps) {
      w.t = Math.min(1, w.t + dt / 0.7)
      const t = w.t
      const u = 1 - t
      w.x = u * u * w.sx + 2 * u * t * w.cx + t * t * this.target.x
      w.y = u * u * w.sy + 2 * u * t * w.cy + t * t * this.target.y
      const fade = t > 0.75 ? (1 - t) / 0.25 : 1
      this.gfx.circle(w.x, w.y, 3).fill({ color: 0xffd9a0, alpha: 0.9 * fade })
      this.gfx.circle(w.x, w.y, 6.5).fill({ color: 0xffc078, alpha: 0.25 * fade })
    }
    this.wisps = this.wisps.filter((w) => w.t < 1)
  }
}

/** Darkens the corners so the eye stays on the road. */
export function vignette(width: number, height: number): Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 144
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(128, 72, 40, 128, 72, 165)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(0.6, 'rgba(0,0,0,0.18)')
  g.addColorStop(1, 'rgba(0,0,0,0.62)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 144)

  const sprite = new Sprite(Texture.from(canvas))
  sprite.width = width
  sprite.height = height
  return sprite
}
