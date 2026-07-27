import { Container, Graphics } from 'pixi.js'
import type { LightingSystem } from './lighting'

/**
 * Kara, rendering only.
 *
 * Her appearance is the one thing here that is not up for design: she is a real dog,
 * a Labrador retriever / pit bull mix with floppy ears, a warm gold coat, and white
 * running from all four paws up her belly and chest to her throat.
 *
 * That coloring is why this class is split into two display objects. `body` sits under
 * the darkness overlay and goes dark with everything else; `markings` sit above it, so
 * in an unlit area she reads as four pale paws and a chest moving through the black.
 *
 * Her abilities — the bark, ear-perk, Show Belly, bubbles, the spring line, the ball
 * stash, toys, the blanket, bond — are NOT implemented. They are specified in
 * docs/design-prompt.md and belong to the design doc, not to me.
 */

/** Lab/pit mix: warm gold coat. */
const GOLD = 0xc9954a
const GOLD_DARK = 0xa2763a
/** White from all four paws up the belly and chest to the throat. */
const WHITE = 0xf6f1e6

/** Placeholder walk speed, px/sec. Real value is a design question. */
const SPEED = 95

export class Kara {
  x: number
  y: number

  /** Body, ears, tail — rendered under the darkness overlay. */
  readonly body = new Container()
  /** Paws, belly, chest — rendered above it, so she stays trackable in the dark. */
  readonly markings = new Container()

  private target: { x: number; y: number } | null = null
  private facing = 0
  private walkCycle = 0

  private readonly bodyGfx = new Graphics()
  private readonly earLeft = new Graphics()
  private readonly earRight = new Graphics()
  private readonly tail = new Graphics()
  private readonly chest = new Graphics()
  private readonly paws: Graphics[] = []

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
    this.draw()
  }

  private draw() {
    this.bodyGfx
      .ellipse(0, 0, 20, 12)
      .fill(GOLD)
      .ellipse(15, 0, 9, 8)
      .fill(GOLD)
      .circle(21, 0, 3)
      .fill(0x2a2320)

    for (const [ear, sign] of [
      [this.earLeft, -1],
      [this.earRight, 1],
    ] as const) {
      ear.ellipse(0, 0, 4, 7).fill(GOLD_DARK)
      ear.position.set(13, sign * 7)
      ear.rotation = sign * 0.5
    }

    this.tail.moveTo(0, 0).quadraticCurveTo(-12, -4, -22, -10).stroke({ width: 4, color: GOLD })
    this.tail.position.set(-18, 0)

    this.body.addChild(this.tail, this.bodyGfx, this.earLeft, this.earRight)

    this.chest.ellipse(8, 0, 9, 7).fill(WHITE)

    for (const [px, py] of [
      [10, -9],
      [10, 9],
      [-9, -9],
      [-9, 9],
    ]) {
      const paw = new Graphics().circle(0, 0, 3.4).fill(WHITE)
      paw.position.set(px, py)
      this.paws.push(paw)
      this.markings.addChild(paw)
    }
    this.markings.addChild(this.chest)
  }

  moveTo(x: number, y: number) {
    this.target = { x, y }
  }

  update(dt: number, lighting: LightingSystem) {
    let moving = false

    if (this.target) {
      const dx = this.target.x - this.x
      const dy = this.target.y - this.y
      const dist = Math.hypot(dx, dy)

      if (dist < 4) {
        this.target = null
      } else {
        moving = true
        this.x += (dx / dist) * SPEED * dt
        this.y += (dy / dist) * SPEED * dt
        this.facing = Math.atan2(dy, dx)
        this.walkCycle += dt * 12
      }
    }

    this.body.position.set(this.x, this.y)
    this.markings.position.set(this.x, this.y)
    this.body.rotation = this.facing
    this.markings.rotation = this.facing

    this.tail.rotation = Math.sin(this.walkCycle) * (moving ? 0.35 : 0.15)

    for (let i = 0; i < this.paws.length; i++) {
      this.paws[i].alpha = moving ? 0.7 + 0.3 * Math.abs(Math.sin(this.walkCycle + i * 1.6)) : 1
    }

    // Her white picks up whatever light is nearest and never fully vanishes.
    const lit = lighting.lightAt(this.x, this.y)
    this.markings.alpha = 0.25 + 0.75 * lit
  }
}
