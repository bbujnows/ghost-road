import { Container, Graphics } from 'pixi.js'
import type { LightingSystem } from './lighting'

export type KaraState = 'idle' | 'moving' | 'chasing' | 'hose' | 'showBelly' | 'blanket'

/** Lab/pit mix: warm gold coat. */
const GOLD = 0xc9954a
const GOLD_DARK = 0xa2763a
/** White from all four paws up the belly and chest to the throat. */
const WHITE = 0xf6f1e6

const SPEED = 95
const CHASE_SPEED = 180
/** Floppy ears, but good ones. She hears it before you see it. */
export const HEARING_RADIUS = 240

const SHOW_BELLY_DURATION = 1.6
const SHOW_BELLY_COOLDOWN = 9

/**
 * Kara is not a tower. She is the only unit the player directly commands, and
 * the only one that can operate outside the light — which is exactly why she matters.
 */
export class Kara {
  x: number
  y: number
  state: KaraState = 'idle'

  /** Ears up. Fires ~2s before a threat becomes visible; the game's primary tell. */
  alert = false

  /** Rises by resting, playing, and throwing the ball. Unlocks Hold, then Lead. */
  bond = 0

  hp = 100

  /** Body, ears, tail — sits under the darkness overlay and goes dark with everything else. */
  readonly body = new Container()
  /** Paws, belly, chest — drawn ABOVE the overlay so she stays trackable in the dark. */
  readonly markings = new Container()

  private target: { x: number; y: number } | null = null
  private facing = 0
  private stateTimer = 0
  private bellyCooldown = 0
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
    // Gold body. The pit shows in the chest, the lab shows in the tail.
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

    // White chest running up to the throat.
    this.chest.ellipse(8, 0, 9, 7).fill(WHITE)

    // All four paws white — in an unlit stretch of road these are the four pale
    // points the player actually tracks her by.
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

  /** Walk her somewhere. */
  moveTo(x: number, y: number) {
    if (this.state === 'blanket' || this.state === 'showBelly') return
    this.target = { x, y }
    this.state = 'moving'
  }

  /** Bubbles: she chases without hesitation. The fastest repositioning tool in the game. */
  chaseBubble(x: number, y: number) {
    if (this.state === 'blanket') return
    this.target = { x, y }
    this.state = 'chasing'
    this.bond += 0.5
  }

  /**
   * She flops onto her back the way she does when she is playing. The white belly
   * turns up and throws reflected light across the area — but she is wide open while down.
   */
  showBelly(): boolean {
    if (this.bellyCooldown > 0 || this.state === 'blanket') return false
    this.state = 'showBelly'
    this.stateTimer = SHOW_BELLY_DURATION
    this.bellyCooldown = SHOW_BELLY_COOLDOWN
    this.bond += 1
    return true
  }

  /** Under the blanket she is hidden and untargetable. She will stay under too long. */
  toggleBlanket() {
    if (this.state === 'blanket') {
      this.state = 'idle'
    } else {
      this.state = 'blanket'
      this.target = null
    }
  }

  get hidden() {
    return this.state === 'blanket'
  }

  get bellyReady() {
    return this.bellyCooldown <= 0
  }

  /** While she is biting at the hose she is healed, cleansed — and unwilling to leave. */
  enterHose() {
    if (this.state !== 'blanket') this.state = 'hose'
  }

  update(dt: number, lighting: LightingSystem, threats: { x: number; y: number }[]) {
    this.bellyCooldown = Math.max(0, this.bellyCooldown - dt)

    if (this.state === 'showBelly') {
      this.stateTimer -= dt
      if (this.stateTimer <= 0) this.state = 'idle'
    }

    // Ear-perk. She orients on the nearest thing she can hear.
    this.alert = false
    let nearest = Infinity
    let nearestThreat: { x: number; y: number } | null = null
    for (const t of threats) {
      const d = Math.hypot(t.x - this.x, t.y - this.y)
      if (d < HEARING_RADIUS && d < nearest) {
        nearest = d
        nearestThreat = t
      }
    }
    if (nearestThreat) this.alert = true

    // Movement.
    const moving = this.state === 'moving' || this.state === 'chasing'
    if (moving && this.target) {
      const dx = this.target.x - this.x
      const dy = this.target.y - this.y
      const dist = Math.hypot(dx, dy)
      const speed = this.state === 'chasing' ? CHASE_SPEED : SPEED

      if (dist < 4) {
        this.target = null
        this.state = 'idle'
      } else {
        this.x += (dx / dist) * speed * dt
        this.y += (dy / dist) * speed * dt
        this.facing = Math.atan2(dy, dx)
        this.walkCycle += dt * 12
      }
    }

    if (this.state === 'hose') {
      this.hp = Math.min(100, this.hp + 8 * dt)
      this.bond += dt * 0.4
    }

    // Face the threat when standing still — she looks at it before you know it is there.
    if (!moving && nearestThreat) {
      this.facing = Math.atan2(nearestThreat.y - this.y, nearestThreat.x - this.x)
    }

    this.render(lighting, moving)
  }

  private render(lighting: LightingSystem, moving: boolean) {
    this.body.position.set(this.x, this.y)
    this.markings.position.set(this.x, this.y)
    this.body.rotation = this.facing
    this.markings.rotation = this.facing

    if (this.hidden) {
      // Burrowed. Only the nose shows.
      this.body.alpha = 0.25
      this.markings.alpha = 0.12
      return
    }

    // Ears lift when she hears something.
    const earLift = this.alert ? 0.9 : 0.5
    this.earLeft.rotation = -earLift
    this.earRight.rotation = earLift

    // Tail wags when she is happy, not when she is working.
    const happy = this.state === 'hose' || this.state === 'chasing'
    this.tail.rotation = happy ? Math.sin(this.walkCycle * 2.2) * 0.6 : Math.sin(this.walkCycle) * 0.15

    const bellyUp = this.state === 'showBelly'
    this.body.scale.set(bellyUp ? 1.08 : 1)

    // Paws bob as she trots.
    for (let i = 0; i < this.paws.length; i++) {
      const p = this.paws[i]
      p.alpha = moving ? 0.7 + 0.3 * Math.abs(Math.sin(this.walkCycle + i * 1.6)) : 1
    }

    this.body.alpha = 1

    // Her white markings pick up whatever light is nearest, and never fully vanish —
    // in pitch dark she is four faint paws and a chest moving through the black.
    const lit = lighting.lightAt(this.x, this.y)
    this.markings.alpha = bellyUp ? 1 : 0.25 + 0.75 * lit
    this.chest.scale.set(bellyUp ? 1.5 : 1)
  }
}
