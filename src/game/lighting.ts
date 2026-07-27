import { Container, Graphics, RenderTexture, Sprite, Texture } from 'pixi.js'
import type { Renderer } from 'pixi.js'
import {
  AMBIENT_LIGHT,
  BAND_BRIGHT,
  BAND_DIM,
  BAND_LIT,
  BRIGHT_DAMAGE_BONUS,
  FALLOFF_EXPONENT,
  FOG_PENALTY,
} from './balance'

/**
 * The lightmap. See design-doc §2.
 *
 * Technique: render a dark ambient base plus additive radial gradients into a
 * RenderTexture, then draw that over the scene with a multiply blend. Unlit areas
 * collapse toward the ambient color; lit areas keep their paint.
 *
 * `lightAt()` is an analytic CPU evaluation of the same falloff the gradient texture
 * encodes. Gameplay queries it; the GPU lightmap is never read back. The two are kept
 * honest by generating the gradient's colour stops from FALLOFF_EXPONENT rather than
 * hand-tuning them — change the exponent and both move together.
 */
export interface Light {
  x: number
  y: number
  radius: number
  color: number
  intensity: number
  flicker?: number
}

/** §2.1. The band a point falls in decides visibility and whether wards can hurt it. */
export type Band = 'dark' | 'dim' | 'lit' | 'bright'

export function bandOf(L: number): Band {
  if (L < BAND_DIM) return 'dark'
  if (L < BAND_LIT) return 'dim'
  if (L < BAND_BRIGHT) return 'lit'
  return 'bright'
}

/** Damage multiplier for a band. Dark and dim deal nothing at all. */
export function damageMultiplier(band: Band): number {
  if (band === 'bright') return BRIGHT_DAMAGE_BONUS
  if (band === 'lit') return 1
  return 0
}

/**
 * The distance at which a single light on its own falls to `threshold`.
 *
 * Worth knowing that these are much smaller than the light's nominal radius: a
 * lantern at `radius 150, intensity 0.85` is only damageable out to ~77px and only
 * visible out to ~118px. The radius is the outer bound of *any* contribution, not the
 * size of the pool the player gets. The placement preview draws these, not the radius,
 * because otherwise nobody can tell what they are buying.
 */
export function radiusForThreshold(light: Pick<Light, 'radius' | 'intensity'>, threshold: number): number {
  const needed = threshold - AMBIENT_LIGHT
  if (needed <= 0) return light.radius
  if (needed > light.intensity) return 0
  return light.radius * (1 - Math.pow(needed / light.intensity, 1 / FALLOFF_EXPONENT))
}

/**
 * How darkness *reads on screen*, which is separate from AMBIENT_LIGHT (the gameplay
 * value). Raising this makes the hollow legible without weakening the mechanic: enemy
 * visibility is gated on the band, not on this colour, so the dark still hides them.
 */
const AMBIENT_COLOR = 0x1a262c

let gradientTexture: Texture | null = null

/**
 * A soft white radial falloff matching (1 − d/r)^FALLOFF_EXPONENT, sampled into
 * colour stops so the render and `lightAt()` cannot drift apart.
 */
function radialGradient(): Texture {
  if (gradientTexture) return gradientTexture

  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)

  const STOPS = 32
  for (let i = 0; i <= STOPS; i++) {
    const t = i / STOPS
    const a = Math.pow(1 - t, FALLOFF_EXPONENT)
    g.addColorStop(t, `rgba(255,255,255,${a.toFixed(4)})`)
  }

  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  gradientTexture = Texture.from(canvas)
  return gradientTexture
}

export class LightingSystem {
  readonly lights: Light[] = []

  /** Add this to the stage ABOVE the scene layer. */
  readonly overlay: Sprite

  /** §2.2. Scales every light in the game down. Raised on the later nights. */
  fogDensity = 0

  private readonly lightLayer = new Container()
  private readonly base: Graphics
  private readonly texture: RenderTexture
  private readonly sprites: Sprite[] = []
  private readonly width: number
  private readonly height: number
  private time = 0

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.texture = RenderTexture.create({ width, height })

    this.base = new Graphics().rect(0, 0, width, height).fill(AMBIENT_COLOR)
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

  /** §2.2. Illumination at a world point, 0..1, fog included. */
  lightAt(x: number, y: number): number {
    let total = AMBIENT_LIGHT

    for (const l of this.lights) {
      const dx = x - l.x
      const dy = y - l.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d >= l.radius) continue
      total += l.intensity * Math.pow(1 - d / l.radius, FALLOFF_EXPONENT)
    }

    return Math.min(1, total) * (1 - FOG_PENALTY * this.fogDensity)
  }

  bandAt(x: number, y: number): Band {
    return bandOf(this.lightAt(x, y))
  }

  update(renderer: Renderer, dt: number) {
    this.time += dt

    // Pool sprites so churn in the light list does not thrash allocation.
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
      s.alpha = Math.max(0, Math.min(1, l.intensity * flicker * (1 - FOG_PENALTY * this.fogDensity)))
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
