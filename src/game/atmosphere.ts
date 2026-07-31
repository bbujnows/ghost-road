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
    /**
     * The texture matches the canvas, so the sharp copy is pixel-exact. It carries Kara's
     * white markings — the one thing that must never go mushy — and at `RenderTexture`'s
     * default resolution of 1 they were being upscaled on every HiDPI screen, which is the
     * opposite of what this comment used to promise.
     */
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.texture = RenderTexture.create({ width, height, resolution: dpr })

    this.sharp = new Sprite(this.texture)

    this.glow = new Sprite(this.texture)
    this.glow.blendMode = 'add'
    this.glow.alpha = 0.55
    // The blur itself runs at HALF resolution. Four passes over the whole frame was the
    // largest single per-frame cost in the game, and a copy whose entire purpose is to be
    // out of focus is the one thing that loses nothing to being resampled.
    this.glow.filters = [new BlurFilter({ strength: 14, quality: 4, resolution: 0.5 })]

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

/** What the next click will do — the readout the OS cursor used to carry. */
export type MothMode = 'idle' | 'armed' | 'hover'

/** Blend two packed RGB colours. */
function mix(a: number, b: number, t: number): number {
  const r = ((a >> 16) & 0xff) + (((b >> 16) & 0xff) - ((a >> 16) & 0xff)) * t
  const g = ((a >> 8) & 0xff) + (((b >> 8) & 0xff) - ((a >> 8) & 0xff)) * t
  const c = (a & 0xff) + ((b & 0xff) - (a & 0xff)) * t
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(c)
}

/**
 * The moth. **It is the cursor** — the OS pointer is hidden over the board.
 *
 * That imposes two rules, and both of them cost something the earlier draft of this class
 * was spending freely:
 *
 *  - **The body sits exactly on the click point.** No wander, no spring, no lag. A cursor
 *    that drifts off the spot it acts on is a cursor that misplaces lantern posts, and
 *    misplaced posts are the specific complaint this game already fixed once. All the life
 *    is in the wings, which beat around a body that does not move.
 *  - **Its mood is the readout.** Hiding the pointer throws away crosshair-means-this-will-
 *    spend-oil, so the moth has to say it instead: warm and fast when a ward is in hand,
 *    wide and bright over something you own, cool and slow when a click does nothing.
 *
 * Rotation is allowed because it turns about the body's centre, which is the click point,
 * so it cannot move where the click lands.
 */
export class Moth {
  readonly gfx = new Graphics()

  /** Wing-beat phase. */
  private wing = 0
  /** 0 at rest, 1 agitated. Rises with pointer movement and with being armed. */
  private flutter = 0
  /** 0 cool, 1 warm — eased, so the mode change is a mood rather than a switch. */
  private warmth = 0
  /** 0 normal, 1 flared wide over something you own. */
  private flare = 0
  private facing = 0
  private lastX = 0
  private lastY = 0

  update(
    dt: number,
    px: number,
    py: number,
    mode: MothMode,
    lightAt: (x: number, y: number) => number,
  ) {
    const dx = px - this.lastX
    const dy = py - this.lastY
    const moved = Math.hypot(dx, dy)
    this.lastX = px
    this.lastY = py

    // Agitated by the hand moving and by carrying something that costs oil. Falls off
    // quickly when both stop, so a resting moth genuinely rests.
    const stirred = Math.min(1, moved / 6) * 0.75 + (mode === 'armed' ? 0.55 : 0)
    const wants = Math.min(1, stirred)
    this.flutter += (wants - this.flutter) * Math.min(1, dt * (wants > this.flutter ? 18 : 3.4))

    this.warmth += ((mode === 'armed' ? 1 : 0) - this.warmth) * Math.min(1, dt * 7)
    this.flare += ((mode === 'hover' ? 1 : 0) - this.flare) * Math.min(1, dt * 9)

    this.wing += dt * (4 + this.flutter * 30)

    // Turns to face the direction of travel, but only while there is travel worth facing
    // and never faster than it could actually turn.
    if (moved > 1.2) {
      const want = Math.atan2(dy, dx) + Math.PI / 2
      let delta = ((want - this.facing + Math.PI) % (Math.PI * 2)) - Math.PI
      if (delta < -Math.PI) delta += Math.PI * 2
      this.facing += delta * Math.min(1, dt * 12)
    }

    this.draw(px, py, lightAt(px, py))
  }

  private draw(px: number, py: number, lit: number) {
    const g = this.gfx.clear()
    // Pinned. This is the whole contract of the class.
    g.position.set(px, py)
    g.rotation = this.facing

    // Wings beat while agitated and are held open at rest; flared wider again over
    // anything you own, which is what makes "this click opens something" legible.
    const beat = 0.32 + Math.abs(Math.cos(this.wing)) * 0.68
    const open = (1 - this.flutter * (1 - beat)) * (1 + this.flare * 0.3)
    const w = 6.5 * open

    // Always readable — it is the cursor — but it still catches the light, so it belongs
    // to the hollow rather than to the HUD.
    const a = (0.62 + Math.min(1, lit) * 0.34) * (1 + this.flare * 0.14)

    const upper = mix(0xe4dfd0, 0xffc078, this.warmth)
    const lower = mix(0xd2ccbc, 0xe8a559, this.warmth)
    const dust = mix(0xbfcfc4, 0xffb060, this.warmth)

    // A soft halo, warm when armed. It reads as the moth having found a flame.
    g.ellipse(0, 0, 9, 7.5).fill({ color: dust, alpha: (0.05 + this.warmth * 0.09) * a })
    g.ellipse(-w * 0.55, -1.5, w, 4.2).fill({ color: upper, alpha: 0.78 * a })
    g.ellipse(w * 0.55, -1.5, w, 4.2).fill({ color: lower, alpha: 0.72 * a })
    g.ellipse(-w * 0.4, 2, w * 0.62, 2.6).fill({ color: lower, alpha: 0.6 * a })
    g.ellipse(w * 0.4, 2, w * 0.62, 2.6).fill({ color: lower, alpha: 0.55 * a })
    g.ellipse(0, 0, 1.25, 3.6).fill({ color: 0x2e2a24, alpha: 0.88 * a })
    g.moveTo(-0.6, -3)
      .lineTo(-2.4, -6)
      .moveTo(0.6, -3)
      .lineTo(2.4, -6)
      .stroke({ width: 0.7, color: 0x2e2a24, alpha: 0.7 * a })
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
  /** The stretch of road the coming gust will cross, shown during the warning. */
  private band: { y: number; halfHeight: number; t: number } | null = null
  private bandGfx = new Graphics()

  constructor(width: number, height: number, count = 14) {
    this.width = width
    this.container.addChild(this.gfx, this.bandGfx, this.gustGfx)

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

  /**
   * Called when the gust's band is chosen, a beat before the front arrives.
   *
   * The band has to be *visible*, not just announced. A warning the player cannot act on
   * is a countdown; a warning that shows which stretch of road is about to go dark is a
   * decision — move the dog there, or accept it and cover elsewhere.
   */
  warn(y: number, halfHeight: number) {
    this.band = { y, halfHeight, t: 0 }
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

    // The band: a pale seam across the stretch about to be crossed. It fades in over the
    // warning and is gone once the front has passed through it.
    this.bandGfx.clear()
    if (this.band) {
      this.band.t += dt
      const b = this.band
      const fade = Math.min(1, b.t * 2.2) * Math.max(0, 1 - Math.max(0, b.t - 2.2) / 1.2)
      if (fade <= 0) {
        this.band = null
      } else {
        this.bandGfx
          .rect(0, b.y - b.halfHeight, this.width, b.halfHeight * 2)
          .fill({ color: 0x9fb8cf, alpha: 0.035 * fade })
        for (const edge of [b.y - b.halfHeight, b.y + b.halfHeight]) {
          this.bandGfx
            .moveTo(0, edge)
            .lineTo(this.width, edge)
            .stroke({ width: 1, color: 0xd8e6ea, alpha: 0.16 * fade })
        }
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

  private embers: { x: number; y: number; vx: number; vy: number; life: number; color: number }[] =
    []
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
        color: 0xffb060,
      })
    }
  }

  /**
   * A death coming apart.
   *
   * Wider, slower and colder than `burst`, and in the dead thing's own colour rather than
   * lamplight — this is the body going, not the lantern landing a tick. It rises: the
   * upward drift is what separates a thing dispersing from a thing exploding, and the
   * former is the one that suits the tone.
   */
  dissolve(x: number, y: number, color: number) {
    if (this.embers.length > 140) return
    const n = 10 + Math.floor(Math.random() * 5)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const speed = 10 + Math.random() * 26
      this.embers.push({
        x: x + (Math.random() - 0.5) * 14,
        y: y - 10 - Math.random() * 22,
        vx: Math.cos(a) * speed * 0.7,
        vy: Math.sin(a) * speed * 0.5 - 26,
        life: 0.75 + Math.random() * 0.5,
        color,
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
      // Clamped: a dissolve ember starts with more than a second of life, and an
      // unclamped alpha would hold it at full opacity instead of fading from the off.
      this.gfx
        .circle(e.x, e.y, 1.3 + Math.min(1, e.life))
        .fill({ color: e.color, alpha: Math.max(0, Math.min(1, e.life)) })
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

/**
 * Screen shake.
 *
 * Translates the whole stage, which means that during a shake the picture is a few pixels
 * off from where clicks actually land. That is a real cost and it is why the amplitude is
 * capped low and the decay is quick: the biggest impulse in the game moves the frame 5px
 * on a 1280px board, for under a third of a second, at a moment when the player is
 * reacting to being hit rather than placing a post to the pixel.
 */
export class Shake {
  private t = 0
  private duration = 0
  private amplitude = 0
  private readonly seed = Math.random() * 100

  /**
   * Strongest impulse wins outright rather than accumulating. Three walkers reaching the
   * porch in the same second should not multiply into a screen that will not sit still.
   */
  punch(amplitude: number, duration = 0.28) {
    const remaining = this.amplitude * Math.max(0, 1 - this.t / (this.duration || 1))
    if (amplitude <= remaining) return
    this.amplitude = Math.min(amplitude, 5)
    this.duration = duration
    this.t = 0
  }

  update(dt: number, target: Container) {
    if (this.duration <= 0) return

    this.t += dt
    if (this.t >= this.duration) {
      this.duration = 0
      this.amplitude = 0
      target.position.set(0, 0)
      return
    }

    // Quadratic decay: hits hard and gets out of the way, rather than trailing off.
    const k = 1 - this.t / this.duration
    const a = this.amplitude * k * k

    // Two incommensurate frequencies per axis, so the frame never traces a clean circle
    // or a straight line — either of those reads as a wobble instead of an impact.
    target.position.set(
      Math.sin(this.t * 61 + this.seed) * a,
      Math.sin(this.t * 47 + this.seed * 1.7) * a * 0.8,
    )
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
