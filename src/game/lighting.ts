import { Container, Graphics, RenderTexture, Sprite, Texture } from 'pixi.js'
import type { Renderer } from 'pixi.js'
import { AMBIENT_LIGHT, BAND_DIM, BAND_LIT, FALLOFF_CORE, FOG_PENALTY } from './balance'

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
  /**
   * Radius across the light's own axis. Omitted means circular. A Mirror Back lantern
   * throws an oval down the road, which covers more *road* for the same lamp — the
   * upgrade only means anything if the lightmap can actually be non-circular.
   */
  radiusY?: number
  /** Rotation of the oval, radians. Ignored when radiusY is omitted. */
  angle?: number
}

/**
 * §2.1. The band a point falls in decides visibility and whether wards can hurt it.
 * Three bands — Bright was cut by the 2026-07-27 ruling.
 */
export type Band = 'dark' | 'dim' | 'lit'

export function bandOf(L: number): Band {
  if (L < BAND_DIM) return 'dark'
  if (L < BAND_LIT) return 'dim'
  return 'lit'
}

/** Damage multiplier for a band. Dark and dim deal nothing at all. */
export function damageMultiplier(band: Band): number {
  return band === 'lit' ? 1 : 0
}

/** §2.2 flat-core falloff: 1 inside the core, smoothstep to 0 at the radius. */
export function falloffAt(d: number, radius: number): number {
  if (d >= radius) return 0
  const core = FALLOFF_CORE * radius
  if (d <= core) return 1
  const t = (d - core) / (radius - core)
  return 1 - (3 * t * t - 2 * t * t * t)
}

/**
 * The fraction of a light's radius at which it falls to `threshold`. Inverts `falloffAt`
 * by bisection on the normalised curve, so it applies to each axis of an oval equally.
 */
export function reachFraction(intensity: number, threshold: number): number {
  const needed = (threshold - AMBIENT_LIGHT) / intensity
  if (needed <= 0) return 1
  if (needed > 1) return 0

  let lo = 0
  let hi = 1
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (falloffAt(mid, 1) > needed) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * The distance at which a single light on its own falls to `threshold`. Under flat-core
 * the delivered radii sit close to the authored one (lit ~85% of radius for a lantern) —
 * but everything player-facing still draws these, never the raw radius, so the promise
 * stays honest if tuning changes.
 */
export function radiusForThreshold(light: Pick<Light, 'radius' | 'intensity'>, threshold: number): number {
  return light.radius * reachFraction(light.intensity, threshold)
}

/**
 * How darkness *reads on screen*, which is separate from AMBIENT_LIGHT (the gameplay
 * value). Raising this makes the hollow legible without weakening the mechanic: enemy
 * visibility is gated on the band, not on this colour, so the dark still hides them.
 */
const AMBIENT_COLOR = 0x1a262c

let gradientTexture: Texture | null = null

/**
 * A soft white radial gradient sampled from `falloffAt`, so the render and
 * `lightAt()` cannot drift apart — both read the same curve.
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
    const a = falloffAt(t, 1)
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

      if (l.radiusY === undefined) {
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d >= l.radius) continue
        total += l.intensity * falloffAt(d, l.radius)
        continue
      }

      // Oval: rotate into the light's own frame, then normalise each axis. The falloff
      // curve is the same one, read at the normalised distance — `falloffAt(d/r, 1)` is
      // identical to `falloffAt(d, r)`, so a circle is just the case where both radii
      // agree and nothing about the lighting model has changed.
      const a = l.angle ?? 0
      const cos = Math.cos(-a)
      const sin = Math.sin(-a)
      const lx = (dx * cos - dy * sin) / l.radius
      const ly = (dx * sin + dy * cos) / l.radiusY
      const n = Math.sqrt(lx * lx + ly * ly)
      if (n >= 1) continue
      total += l.intensity * falloffAt(n, 1)
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
      s.height = (l.radiusY ?? l.radius) * 2
      s.rotation = l.angle ?? 0
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
