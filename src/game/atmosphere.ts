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
