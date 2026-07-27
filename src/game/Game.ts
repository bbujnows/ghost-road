import { Application, Container, Graphics } from 'pixi.js'
import {
  BAND_DIM,
  BAND_LIT,
  HOMESTEAD_MAX_HP,
  LANTERN,
  NIGHT_1_STARTING_OIL,
  NIGHT_1_WAVES,
  OIL_PER_LIT_KILL,
  WAVE_BREAK,
} from './balance'
import { RoadWalker } from './enemies'
import { Kara } from './kara'
import { LightingSystem, bandOf, radiusForThreshold } from './lighting'
import type { Band } from './lighting'
import { Lantern } from './wards'
import { HOMESTEAD, buildScene } from './world'

export const WORLD_WIDTH = 1280
export const WORLD_HEIGHT = 720

export type Phase = 'wave' | 'break' | 'failed' | 'complete'

export interface GameState {
  phase: Phase
  wave: number
  waveCount: number
  homesteadHp: number
  homesteadMaxHp: number
  oil: number
  canAffordLantern: boolean
  walkersAlive: number
  /** Seconds until the next wave, during a break. */
  breakRemaining: number
  paused: boolean
  lightUnderCursor: number
  bandUnderCursor: Band
  /** Null when a lantern can be placed under the cursor. */
  placementBlocker: string | null
}

/**
 * design-doc §13 steps 1–2: the lightmap and its bands, then a lantern and a Road
 * Walker. This is the minimum loop that proves light-gated damage is fun rather than
 * merely clever.
 *
 * Deliberately absent, because the build order says so: Kara's abilities (she walks
 * and nothing else), every ward except the lantern, every enemy except the walker,
 * fog, bond, stash, toys, nights 2–7, hard mode, and endless.
 *
 * Render layering: scene → lighting.overlay (multiply) → foreground.
 */
export class Game {
  private app = new Application()
  private lighting!: LightingSystem
  private scene = new Container()
  private foreground = new Container()

  private kara!: Kara
  private walkers: RoadWalker[] = []
  private lanterns: Lantern[] = []
  private preview = new Graphics()

  private phase: Phase = 'break'
  private waveIndex = 0
  private spawnQueue: number[] = []
  private elapsed = 0
  private breakTimer = 4
  private homesteadHp = HOMESTEAD_MAX_HP
  private oil = NIGHT_1_STARTING_OIL
  private paused = false

  private pointer = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }
  private stateHandler: ((s: GameState) => void) | null = null
  private detach: (() => void)[] = []

  async mount(host: HTMLElement) {
    await this.app.init({
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      background: 0x0b1114,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    })
    host.appendChild(this.app.canvas)

    this.lighting = new LightingSystem(WORLD_WIDTH, WORLD_HEIGHT)
    this.scene.addChild(buildScene(WORLD_WIDTH, WORLD_HEIGHT))

    // The porch light. The only light the player starts with, and it covers the last
    // few metres of road only — everything above it is dark until they pay for it.
    this.lighting.add({
      x: HOMESTEAD.x,
      y: HOMESTEAD.y - 36,
      radius: 190,
      color: 0xffc078,
      intensity: 0.5,
      flicker: 0.04,
    })

    this.kara = new Kara(HOMESTEAD.x - 100, HOMESTEAD.y - 20)
    this.scene.addChild(this.kara.body)
    this.foreground.addChild(this.kara.markings)

    // Above the darkness overlay, so the player can see where the pool will land.
    this.foreground.addChild(this.preview)

    this.app.stage.addChild(this.scene, this.lighting.overlay, this.foreground)

    this.bindInput()
    this.app.ticker.add((ticker) => this.tick(Math.min(ticker.deltaMS / 1000, 0.05)))
  }

  onState(handler: (s: GameState) => void) {
    this.stateHandler = handler
  }

  private bindInput() {
    const canvas = this.app.canvas
    canvas.style.cursor = 'crosshair'

    const toWorld = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      return {
        x: ((e.clientX - r.left) / r.width) * WORLD_WIDTH,
        y: ((e.clientY - r.top) / r.height) * WORLD_HEIGHT,
      }
    }

    const onMove = (e: MouseEvent) => {
      this.pointer = toWorld(e)
    }
    const onDown = (e: MouseEvent) => {
      const p = toWorld(e)
      if (e.button === 2) this.kara.moveTo(p.x, p.y)
      else this.placeLantern(p.x, p.y)
    }
    const onContext = (e: Event) => e.preventDefault()
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === ' ') {
        e.preventDefault()
        this.paused = !this.paused
      } else if (key === 'r' && this.phase === 'failed') {
        this.retryNight()
      }
    }
    // §11: pause the instant the tab loses focus. It is a game played at a desk.
    const onBlur = () => {
      this.paused = true
    }

    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mousedown', onDown)
    canvas.addEventListener('contextmenu', onContext)
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', onBlur)

    this.detach.push(
      () => canvas.removeEventListener('mousemove', onMove),
      () => canvas.removeEventListener('mousedown', onDown),
      () => canvas.removeEventListener('contextmenu', onContext),
      () => window.removeEventListener('keydown', onKey),
      () => window.removeEventListener('blur', onBlur),
    )
  }

  /** Why a lantern cannot go here, or null if it can. */
  private placementBlocker(x: number, y: number): string | null {
    if (this.phase === 'failed' || this.phase === 'complete') return 'not now'
    if (this.oil < LANTERN.cost) return 'not enough oil'
    // Overlapping pools is the point (§2.1 bright band); stacking them is degenerate.
    for (const l of this.lanterns) {
      if (Math.hypot(l.x - x, l.y - y) < LANTERN.minSpacing) return 'too close to another lantern'
    }
    if (Math.hypot(x - HOMESTEAD.x, y - HOMESTEAD.y) < 70) return 'too close to the homestead'
    return null
  }

  /**
   * Draws what the player is actually buying: the inner ring is the damageable zone,
   * the outer is the edge of visibility. Neither is the lantern's nominal radius, and
   * the gap between them is the thing that has to be taught in the first thirty
   * seconds of Night 1.
   */
  private drawPreview() {
    this.preview.clear()

    const { x, y } = this.pointer
    if (this.phase === 'failed' || this.phase === 'complete' || this.paused) return

    const blocked = this.placementBlocker(x, y) !== null
    const litR = radiusForThreshold(LANTERN, BAND_LIT)
    const dimR = radiusForThreshold(LANTERN, BAND_DIM)
    const color = blocked ? 0xff8f6b : 0xffc078

    this.preview
      .circle(x, y, dimR)
      .stroke({ width: 1, color, alpha: blocked ? 0.25 : 0.28 })
      .circle(x, y, litR)
      .stroke({ width: 1.5, color, alpha: blocked ? 0.35 : 0.6 })
      .circle(x, y, litR)
      .fill({ color, alpha: blocked ? 0.03 : 0.06 })
  }

  private placeLantern(x: number, y: number) {
    if (this.placementBlocker(x, y) !== null) return

    this.oil -= LANTERN.cost
    const lantern = new Lantern(x, y, this.lighting)
    this.lanterns.push(lantern)
    this.scene.addChild(lantern.gfx)
  }

  private queueWave(index: number) {
    const wave = NIGHT_1_WAVES[index]
    this.spawnQueue = []
    for (let i = 0; i < wave.count; i++) {
      this.spawnQueue.push(this.elapsed + i * wave.gap)
    }
    this.phase = 'wave'
  }

  /** §7.1 Normal: replay the night from wave 1. Oil and wards reset with it. */
  private retryNight() {
    for (const w of this.walkers) {
      this.scene.removeChild(w.gfx)
      w.gfx.destroy()
    }
    this.walkers = []

    for (const l of this.lanterns) {
      this.lighting.remove(l.light)
      this.scene.removeChild(l.gfx)
      l.gfx.destroy()
    }
    this.lanterns = []

    this.homesteadHp = HOMESTEAD_MAX_HP
    this.oil = NIGHT_1_STARTING_OIL
    this.waveIndex = 0
    this.spawnQueue = []
    this.breakTimer = 4
    this.phase = 'break'
  }

  private tick(dt: number) {
    if (this.paused || this.phase === 'failed' || this.phase === 'complete') {
      this.lighting.update(this.app.renderer, dt)
      this.drawPreview()
      this.publish()
      return
    }

    this.elapsed += dt

    if (this.phase === 'break') {
      this.breakTimer -= dt
      if (this.breakTimer <= 0) this.queueWave(this.waveIndex)
    }

    while (this.spawnQueue.length && this.spawnQueue[0] <= this.elapsed) {
      this.spawnQueue.shift()
      const walker = new RoadWalker()
      this.walkers.push(walker)
      this.scene.addChild(walker.gfx)
    }

    for (const lantern of this.lanterns) lantern.update(dt, this.walkers, this.lighting)

    for (const walker of this.walkers) {
      walker.update(dt, this.lighting)
      if (walker.arrived) {
        this.homesteadHp -= walker.porchDamage
        walker.hp = 0
      }
    }

    // Cleanup. Oil is only awarded for kills, not for walkers that reached the porch.
    const survivors: RoadWalker[] = []
    for (const walker of this.walkers) {
      if (!walker.dead) {
        survivors.push(walker)
        continue
      }
      if (!walker.arrived) this.oil += OIL_PER_LIT_KILL
      this.scene.removeChild(walker.gfx)
      walker.gfx.destroy()
    }
    this.walkers = survivors

    if (this.homesteadHp <= 0) {
      this.homesteadHp = 0
      this.phase = 'failed'
    } else if (this.phase === 'wave' && !this.spawnQueue.length && !this.walkers.length) {
      this.waveIndex++
      if (this.waveIndex >= NIGHT_1_WAVES.length) {
        this.phase = 'complete'
      } else {
        this.breakTimer = WAVE_BREAK
        this.phase = 'break'
      }
    }

    this.kara.update(dt, this.lighting)
    this.lighting.update(this.app.renderer, dt)
    this.drawPreview()
    this.publish()
  }

  private publish() {
    if (!this.stateHandler) return
    const L = this.lighting.lightAt(this.pointer.x, this.pointer.y)

    this.stateHandler({
      phase: this.phase,
      wave: Math.min(this.waveIndex + 1, NIGHT_1_WAVES.length),
      waveCount: NIGHT_1_WAVES.length,
      homesteadHp: Math.max(0, this.homesteadHp),
      homesteadMaxHp: HOMESTEAD_MAX_HP,
      oil: Math.floor(this.oil),
      canAffordLantern: this.oil >= LANTERN.cost,
      walkersAlive: this.walkers.length,
      breakRemaining: Math.max(0, this.breakTimer),
      paused: this.paused,
      lightUnderCursor: L,
      bandUnderCursor: bandOf(L),
      placementBlocker: this.placementBlocker(this.pointer.x, this.pointer.y),
    })
  }

  destroy() {
    for (const off of this.detach) off()
    this.detach = []
    this.lighting?.destroy()
    this.app.destroy(true, { children: true })
  }
}
