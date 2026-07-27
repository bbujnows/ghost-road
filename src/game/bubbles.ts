import { Container, Graphics } from 'pixi.js'
import { BUBBLES } from './balance'
import type { Light, LightingSystem } from './lighting'

/**
 * A soap bubble. Kara chases them without hesitation.
 *
 * Each one carries a weak light that sits in the Dim band — enough to resolve an
 * invisible thing, never enough to let a ward hurt it. A bubble trail is a scouting
 * line, not a portable lantern, and keeping it below the damage threshold is what
 * stops Bubbles from replacing the Lantern Post.
 */
export class Bubble {
  x: number
  y: number

  readonly light: Light
  /** Drawn above the darkness overlay and fed into the bloom. */
  readonly gfx = new Container()

  private life = BUBBLES.lifetime
  private drift = (Math.random() - 0.5) * 2
  private wobble = Math.random() * Math.PI * 2
  private skin = new Graphics()

  constructor(x: number, y: number, lighting: LightingSystem) {
    this.x = x
    this.y = y

    this.light = lighting.add({
      x,
      y,
      radius: BUBBLES.lightRadius,
      color: 0xcfe8ff,
      intensity: BUBBLES.lightIntensity,
    })

    // Rim-lit and hollow, the way a bubble actually reads: bright edge, empty middle.
    this.skin
      .circle(0, 0, 7)
      .stroke({ width: 1.4, color: 0xe8f6ff, alpha: 0.85 })
      .circle(0, 0, 7)
      .fill({ color: 0xa8d8ff, alpha: 0.1 })
      .circle(-2.4, -2.4, 1.9)
      .fill({ color: 0xffffff, alpha: 0.75 })
      .circle(2.6, 2.2, 0.9)
      .fill({ color: 0xffe6bd, alpha: 0.45 })

    this.gfx.addChild(this.skin)
    this.gfx.position.set(x, y)
  }

  get popped() {
    return this.life <= 0
  }

  update(dt: number) {
    this.life -= dt
    this.wobble += dt * 2.4

    // Rises and wanders. Nothing about a bubble travels in a straight line.
    this.y -= 14 * dt
    this.x += (this.drift * 12 + Math.sin(this.wobble) * 14) * dt

    this.light.x = this.x
    this.light.y = this.y

    // Fades over the last second rather than blinking out.
    const fade = Math.max(0, Math.min(1, this.life))
    this.light.intensity = BUBBLES.lightIntensity * fade

    this.gfx.position.set(this.x, this.y)
    this.gfx.alpha = fade
    // Swells very slightly as it thins, which is what a bubble does before it goes.
    this.skin.scale.set(1 + (1 - fade) * 0.18)
  }
}
