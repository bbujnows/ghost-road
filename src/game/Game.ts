import { Application, Container } from 'pixi.js'
import { buildRoad, HAINTS, Haint } from './enemies'
import { Kara } from './kara'
import { LightingSystem } from './lighting'
import { NIGHTS } from './nights'
import { buildWorld, HOMESTEAD } from './world'
import { Bubble, Lantern, SpringLine, WARDS } from './wards'

export const WORLD_WIDTH = 1280
export const WORLD_HEIGHT = 720

export type WardId = 'lantern' | 'hose'

export interface GameState {
  night: number
  nightName: string
  wave: number
  waveCount: number
  homesteadHp: number
  oil: number
  balls: number
  bond: number
  karaHp: number
  karaState: string
  karaAlert: boolean
  bellyReady: boolean
  selectedWard: WardId
  paused: boolean
  /** Set for a moment when Kara barks. She only does this if something reached the porch. */
  barking: boolean
  outcome: 'playing' | 'survived' | 'lost'
}

/**
 * Playable skeleton. The systems that matter — the lightmap, light-gated damage,
 * Kara's commands, running water — are real. Balance, art, audio, and nights 4-7
 * are not yet.
 */
export class Game {
  private app = new Application()
  private lighting!: LightingSystem
  private scene = new Container()
  private foreground = new Container()

  private kara!: Kara
  private road = buildRoad(WORLD_WIDTH, WORLD_HEIGHT)
  private haints: Haint[] = []
  private lanterns: Lantern[] = []
  private springs: SpringLine[] = []
  private bubbles: Bubble[] = []

  private nightIndex = 0
  private waveIndex = 0
  private spawnQueue: { kind: string; at: number }[] = []
  private elapsed = 0
  private waveBreak = 3

  private homesteadHp = 100
  private oil = 90
  private balls = 0
  private selectedWard: WardId = 'lantern'
  private paused = false
  private barkTimer = 0
  private barkedThisNight = false
  private outcome: GameState['outcome'] = 'playing'

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

    // Moonlight. Never enough of it.
    this.lighting.add({ x: WORLD_WIDTH / 2, y: 60, radius: 900, color: 0x5f7fa8, intensity: 0.16 })

    const home = HOMESTEAD(WORLD_WIDTH, WORLD_HEIGHT)
    this.lighting.add({ x: home.x, y: home.y - 30, radius: 190, color: 0xffc078, intensity: 0.5, flicker: 0.04 })

    this.scene.addChild(buildWorld(WORLD_WIDTH, WORLD_HEIGHT, this.road))

    this.kara = new Kara(home.x - 90, home.y - 20)
    this.scene.addChild(this.kara.body)
    this.foreground.addChild(this.kara.markings)

    // Scene, then the lightmap over it, then the things that must stay visible in the dark.
    this.app.stage.addChild(this.scene, this.lighting.overlay, this.foreground)

    this.startNight(0)
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
    const onClick = (e: MouseEvent) => {
      const p = toWorld(e)
      if (e.button === 2) this.kara.moveTo(p.x, p.y)
      else this.placeWard(p.x, p.y)
    }
    const onContext = (e: Event) => e.preventDefault()
    const onKey = (e: KeyboardEvent) => this.handleKey(e)

    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mousedown', onClick)
    canvas.addEventListener('contextmenu', onContext)
    window.addEventListener('keydown', onKey)

    this.detach.push(
      () => canvas.removeEventListener('mousemove', onMove),
      () => canvas.removeEventListener('mousedown', onClick),
      () => canvas.removeEventListener('contextmenu', onContext),
      () => window.removeEventListener('keydown', onKey),
    )
  }

  private handleKey(e: KeyboardEvent) {
    switch (e.key.toLowerCase()) {
      case '1':
        this.selectedWard = 'lantern'
        break
      case '2':
        this.selectedWard = 'hose'
        break
      case 'b':
        this.blowBubble()
        break
      case 'x':
        this.kara.showBelly()
        break
      case 'z':
        this.kara.toggleBlanket()
        break
      case ' ':
        e.preventDefault()
        this.paused = !this.paused
        break
    }
  }

  private placeWard(x: number, y: number) {
    const kind = WARDS[this.selectedWard]
    if (this.oil < kind.cost) return

    // Nothing goes on the porch itself.
    const home = HOMESTEAD(WORLD_WIDTH, WORLD_HEIGHT)
    if (Math.hypot(x - home.x, y - home.y) < 80) return

    this.oil -= kind.cost

    if (this.selectedWard === 'lantern') {
      const lantern = new Lantern(x, y, this.lighting)
      this.lanterns.push(lantern)
      this.scene.addChild(lantern.gfx)
    } else {
      const spring = new SpringLine(x, y, this.lighting)
      this.springs.push(spring)
      this.scene.addChild(spring.gfx)
      this.foreground.addChild(spring.mist)
    }
  }

  /** Bubbles pull her instantly — and are the only reliable way to get her off the water. */
  private blowBubble() {
    const bubble = new Bubble(this.pointer.x, this.pointer.y, this.lighting)
    this.bubbles.push(bubble)
    this.foreground.addChild(bubble.gfx)
    this.kara.chaseBubble(bubble.x, bubble.y)
  }

  private startNight(index: number) {
    const night = NIGHTS[Math.min(index, NIGHTS.length - 1)]
    this.nightIndex = index
    this.waveIndex = 0
    this.oil = night.startingOil
    this.barkedThisNight = false
    this.queueWave()
  }

  private queueWave() {
    const night = NIGHTS[Math.min(this.nightIndex, NIGHTS.length - 1)]
    const wave = night.waves[this.waveIndex]
    if (!wave) return

    this.spawnQueue = []
    for (const group of wave) {
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push({ kind: group.kind, at: this.elapsed + group.delay + i * group.gap })
      }
    }
    this.spawnQueue.sort((a, b) => a.at - b.at)
  }

  private tick(dt: number) {
    if (this.paused || this.outcome !== 'playing') {
      this.publish()
      return
    }

    this.elapsed += dt
    this.barkTimer = Math.max(0, this.barkTimer - dt)

    // Spawning.
    while (this.spawnQueue.length && this.spawnQueue[0].at <= this.elapsed) {
      const next = this.spawnQueue.shift()!
      const haint = new Haint(HAINTS[next.kind], this.road)
      this.haints.push(haint)
      this.scene.addChild(haint.gfx)
    }

    // Wave / night progression.
    if (!this.spawnQueue.length && !this.haints.length) {
      this.waveBreak -= dt
      if (this.waveBreak <= 0) {
        this.waveBreak = 3
        const night = NIGHTS[Math.min(this.nightIndex, NIGHTS.length - 1)]
        this.waveIndex++
        if (this.waveIndex >= night.waves.length) {
          this.balls += 3
          if (this.nightIndex + 1 >= NIGHTS.length) this.outcome = 'survived'
          else this.startNight(this.nightIndex + 1)
        } else {
          this.queueWave()
        }
      }
    }

    // Kara. She hears things the wards cannot see.
    const threats = this.haints.map((h) => ({ x: h.x, y: h.y }))
    this.kara.update(dt, this.lighting, threats)

    // She cannot resist the spray, and she will not leave it on her own.
    let inWater = false
    for (const spring of this.springs) {
      const near = Math.hypot(this.kara.x - spring.x, this.kara.y - spring.y) < spring.radius * 0.5
      spring.amplified = near
      if (near) inWater = true
      spring.update(dt)
    }
    if (inWater && this.kara.state !== 'blanket') this.kara.enterHose()

    for (const lantern of this.lanterns) lantern.update(dt, this.haints, this.lighting)

    // Show Belly: white belly up, reflected light across the area.
    if (this.kara.state === 'showBelly') {
      this.lighting.add({
        x: this.kara.x,
        y: this.kara.y,
        radius: 170,
        color: 0xfff4e0,
        intensity: 0.55,
      })
      // One-frame light; cleared below so it does not accumulate.
      this.transientLights++
    }

    for (const bubble of this.bubbles) bubble.update(dt)

    // Haints.
    for (const haint of this.haints) {
      haint.update(dt, this.lighting)

      // Running water turns them.
      for (const spring of this.springs) {
        if (spring.repels(haint.x, haint.y)) {
          const away = Math.atan2(haint.y - spring.y, haint.x - spring.x)
          haint.x += Math.cos(away) * 40 * dt
          haint.y += Math.sin(away) * 40 * dt
        }
      }

      if (haint.progress >= 1) {
        this.homesteadHp -= 8
        haint.hp = 0
        // She is silent all game. If she barks, something is on the porch.
        if (!this.barkedThisNight) {
          this.barkedThisNight = true
          this.barkTimer = 1.4
        }
      }
    }

    // Cleanup.
    for (const haint of this.haints.filter((h) => h.dead)) {
      this.scene.removeChild(haint.gfx)
      haint.gfx.destroy()
      this.oil += 8
    }
    this.haints = this.haints.filter((h) => !h.dead)

    for (const bubble of this.bubbles.filter((b) => b.popped)) {
      this.lighting.remove(bubble.light)
      this.foreground.removeChild(bubble.gfx)
      bubble.gfx.destroy()
    }
    this.bubbles = this.bubbles.filter((b) => !b.popped)

    if (this.homesteadHp <= 0) this.outcome = 'lost'

    this.lighting.update(this.app.renderer, dt)
    this.clearTransientLights()
    this.publish()
  }

  private transientLights = 0

  private clearTransientLights() {
    while (this.transientLights > 0) {
      this.lighting.lights.pop()
      this.transientLights--
    }
  }

  private publish() {
    if (!this.stateHandler) return
    const night = NIGHTS[Math.min(this.nightIndex, NIGHTS.length - 1)]
    this.stateHandler({
      night: night.index,
      nightName: night.name,
      wave: Math.min(this.waveIndex + 1, night.waves.length),
      waveCount: night.waves.length,
      homesteadHp: Math.max(0, this.homesteadHp),
      oil: Math.floor(this.oil),
      balls: this.balls,
      bond: Math.floor(this.kara.bond),
      karaHp: Math.floor(this.kara.hp),
      karaState: this.kara.state,
      karaAlert: this.kara.alert,
      bellyReady: this.kara.bellyReady,
      selectedWard: this.selectedWard,
      paused: this.paused,
      barking: this.barkTimer > 0,
      outcome: this.outcome,
    })
  }

  destroy() {
    for (const off of this.detach) off()
    this.detach = []
    this.lighting?.destroy()
    this.app.destroy(true, { children: true })
  }
}
