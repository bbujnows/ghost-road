import { Graphics } from 'pixi.js'
import type { LightingSystem } from './lighting'

export interface Vec2 {
  x: number
  y: number
}

export interface HaintKind {
  id: string
  name: string
  hp: number
  speed: number
  color: number
  radius: number
  /** Invisible until something reveals it. Kara's hearing is the counter. */
  unseen?: boolean
}

export const HAINTS: Record<string, HaintKind> = {
  walker: { id: 'walker', name: 'Road Walker', hp: 30, speed: 34, color: 0x8fa9b8, radius: 9 },
  crawler: { id: 'crawler', name: 'Crawler', hp: 18, speed: 58, color: 0x9c8fb8, radius: 7 },
  unseen: { id: 'unseen', name: 'The Unseen', hp: 44, speed: 30, color: 0x6f7f92, radius: 10, unseen: true },
  hollow: { id: 'hollow', name: 'Hollow Kin', hp: 120, speed: 22, color: 0xb88f8f, radius: 14 },
}

export class Haint {
  x: number
  y: number
  hp: number
  readonly maxHp: number
  readonly kind: HaintKind

  /** Distance travelled along the road, in path units. */
  private t = 0
  private wobble = Math.random() * Math.PI * 2

  readonly gfx = new Graphics()

  private readonly path: Vec2[]

  constructor(kind: HaintKind, path: Vec2[]) {
    this.kind = kind
    this.path = path
    this.hp = kind.hp
    this.maxHp = kind.hp
    this.x = path[0].x
    this.y = path[0].y
    this.drawSelf()
  }

  private drawSelf() {
    const { radius, color } = this.kind
    this.gfx
      .ellipse(0, radius * 0.5, radius * 0.9, radius * 0.4)
      .fill({ color: 0x000000, alpha: 0.25 })
      .circle(0, 0, radius)
      .fill({ color, alpha: 0.75 })
      .circle(0, 0, radius * 0.55)
      .fill({ color: 0xffffff, alpha: 0.12 })
  }

  get dead() {
    return this.hp <= 0
  }

  /** Fraction of the road covered, 0..1. At 1 it is standing on the homestead. */
  get progress() {
    return Math.min(1, this.t / (this.path.length - 1))
  }

  /**
   * Enemies are only damageable inside lit areas. This is the whole game — a ward
   * pointed at an unlit stretch of road is decoration.
   */
  damage(amount: number, lighting: LightingSystem): boolean {
    if (!lighting.isLit(this.x, this.y)) return false
    this.hp -= amount
    return true
  }

  update(dt: number, lighting: LightingSystem) {
    const segment = Math.floor(this.t)
    const from = this.path[Math.min(segment, this.path.length - 1)]
    const to = this.path[Math.min(segment + 1, this.path.length - 1)]
    const segLength = Math.hypot(to.x - from.x, to.y - from.y) || 1

    this.t += (this.kind.speed * dt) / segLength

    const frac = this.t - segment
    this.x = from.x + (to.x - from.x) * frac
    this.y = from.y + (to.y - from.y) * frac

    // Drift, so they do not read as beads on a wire.
    this.wobble += dt * 1.7
    this.x += Math.sin(this.wobble) * 8 * dt * 10

    const lit = lighting.lightAt(this.x, this.y)

    // The Unseen only resolves inside light. In the dark you have to trust Kara's ears.
    this.gfx.alpha = this.kind.unseen ? 0.06 + lit * 0.94 : 0.55 + lit * 0.45
    this.gfx.position.set(this.x, this.y)
    this.gfx.scale.set(1 + (1 - this.hp / this.maxHp) * -0.15)
  }
}

/** The road the hollow's dead walk down. Wanders enough to make lighting it a real puzzle. */
export function buildRoad(width: number, height: number): Vec2[] {
  const cx = width / 2
  return [
    { x: cx + 40, y: -60 },
    { x: cx + 10, y: 90 },
    { x: cx - 130, y: 200 },
    { x: cx - 150, y: 320 },
    { x: cx + 30, y: 400 },
    { x: cx + 180, y: 470 },
    { x: cx + 120, y: 560 },
    { x: cx, y: height - 90 },
  ]
}
