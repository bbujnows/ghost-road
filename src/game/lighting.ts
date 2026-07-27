import { Container, Graphics, RenderTexture, Sprite, Texture } from 'pixi.js'
import type { Renderer } from 'pixi.js'

/**
 * The lightmap.
 *
 * Technique: render a dark ambient base plus additive radial gradients into a
 * RenderTexture, then draw that over the scene with a multiply blend. Unlit areas
 * collapse toward the ambient color; lit areas keep their paint.
 *
 * The design calls for light to gate damage — enemies damageable only inside lit
 * areas — which is what `lightAt()` is for. The threshold that counts as "lit", and
 * everything that depends on it, is a design decision and is not made here.
 */
export interface Light {
  x: number
  y: number
  radius: number
  /** Tint of the light itself — warm amber for lanterns, cold blue for moonlight. */
  color: number
  /** 0..1. Flicker rides on top of this. */
  intensity: number
  /** Amplitude of the per-frame flicker, 0 for a steady light. */
  flicker?: number
}

/** How dark an unlit tile gets. Never pure black — the hollow always has some moon. */
export const AMBIENT = 0x0e161c

let gradientTexture: Texture | null = null

/** A soft white radial falloff, reused (tinted) by every light in the game. */
function radialGradient(): Texture {
  if (gradientTexture) return gradientTexture

  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  // Slightly hot core, long soft tail — reads more like a lantern than a spotlight.
  g.addColorStop(0.0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.7, 'rgba(255,255,255,0.15)')
  g.addColorStop(1.0, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  gradientTexture = Texture.from(canvas)
  return gradientTexture
}

export class LightingSystem {
  readonly lights: Light[] = []

  /** Add this to the stage ABOVE the scene layer. */
  readonly overlay: Sprite

  private readonly lightLayer = new Container()
  private readonly base: Graphics
  private readonly texture: RenderTexture
  private readonly sprites: Sprite[] = []
  private time = 0

  private readonly width: number
  private readonly height: number

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.texture = RenderTexture.create({ width, height })

    this.base = new Graphics().rect(0, 0, width, height).fill(AMBIENT)
    this.lightLayer.addChild(this.base)

    this.overlay = new Sprite(this.texture)
    this.overlay.blendMode = 'multiply'
  }

  add(light: Light): Light {
    this.lights.push(light)
    return light
  }

  remove(light: Light) {
    const i = this.lights.indexOf(light)
    if (i >= 0) this.lights.splice(i, 1)
  }

  /**
   * How lit a world point is, 0..1. Cheap analytic approximation of the lightmap —
   * used to gate enemy damage and to decide how brightly Kara's white markings read.
   */
  lightAt(x: number, y: number): number {
    let total = 0
    for (const l of this.lights) {
      const dx = x - l.x
      const dy = y - l.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < l.radius) total += l.intensity * (1 - d / l.radius)
    }
    return Math.min(1, total)
  }

  update(renderer: Renderer, dt: number) {
    this.time += dt

    // Pool sprites so a wave of bubble-lights does not thrash allocation.
    while (this.sprites.length < this.lights.length) {
      const s = new Sprite(radialGradient())
      s.anchor.set(0.5)
      s.blendMode = 'add'
      this.sprites.push(s)
      this.lightLayer.addChild(s)
    }

    for (let i = 0; i < this.sprites.length; i++) {
      const s = this.sprites[i]
      const l = this.lights[i]

      if (!l) {
        s.visible = false
        continue
      }

      const flicker = l.flicker ? 1 + Math.sin(this.time * 11 + i * 3.7) * l.flicker : 1

      s.visible = true
      s.position.set(l.x, l.y)
      s.width = l.radius * 2
      s.height = l.radius * 2
      s.tint = l.color
      s.alpha = Math.max(0, Math.min(1, l.intensity * flicker))
    }

    renderer.render({ container: this.lightLayer, target: this.texture, clear: true })
  }

  destroy() {
    this.texture.destroy(true)
    this.lightLayer.destroy({ children: true })
  }

  get size() {
    return { width: this.width, height: this.height }
  }
}
