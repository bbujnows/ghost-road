import { Application, Container, Graphics } from 'pixi.js'
import {
  BAND_DIM,
  BAND_LIT,
  BUBBLES,
  COLD_IRON,
  EAR_PERK_LEAD,
  FAST_FORWARD,
  GUST,
  HOLD,
  HOMESTEAD_MAX_HP,
  KARA,
  LANTERN,
  OIL_PER_LIT_KILL,
  OIL_PER_WAVE,
  SHOW_BELLY,
  WAVE_BREAK,
} from './balance'
import { NIGHTS } from './nights'
import type { NightSpec } from './nights'
import {
  alreadyAttempted,
  loadRecord,
  markAttempted,
  nightlyFor,
  recordHeld,
  recordLost,
} from './nightly'
import type { NightlyNight } from './nightly'
import { BRANCHES, BRANCHES_FOR } from './balance'
import type { BranchId, EnemyKind, WardKind } from './balance'
import { Bloom, Motes, Sparks, Weather, vignette } from './atmosphere'
import { Audio } from './audio'
import { Bubble } from './bubbles'
import { Boss, Corpse, setEnemyScale, spawn } from './enemies'
import type { Enemy, EnemyContext } from './enemies'
import { hpScaleFor, loadBest, longRoadNight, saveBest, speedScaleFor } from './longroad'
import { generateRoad } from './roadgen'
import { Kara } from './kara'
import type { KaraMode, Threat } from './kara'
import { TOYS, loadoutFor } from './toys'
import type { ToyId } from './toys'
import {
  BOND,
  FETCH_SECONDS,
  KILLS_PER_FETCH,
  MAX_OIL_UPGRADES,
  SHOP,
  loadProgress,
  saveProgress,
  tierOf,
} from './progression'
import type { Progress } from './progression'
import { LightingSystem, bandOf, reachFraction } from './lighting'
import type { Band, Light } from './lighting'
import { ColdIron, Lantern } from './wards'
import { AUTHORED_ROAD, HOMESTEAD, ROAD, buildScene, setRoad } from './world'
import type { Smoke, Vec2 } from './world'

export const WORLD_WIDTH = 1280
export const WORLD_HEIGHT = 720

/** Seeded RNG, so a Long Road run reproduces its own road and boss order. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function sameRoad(a: Vec2[], b: Vec2[]): boolean {
  if (a.length !== b.length) return false
  return a.every((p, i) => p.x === b[i].x && p.y === b[i].y)
}

export type Phase = 'briefing' | 'wave' | 'break' | 'failed' | 'complete'
export type WardId = WardKind

/** The campaign, today's seeded night, or an endless run. */
export type Mode = 'campaign' | 'nightly' | 'longroad'

/** One branch of the selected ward, as the HUD needs to draw it. */
export interface BranchOption {
  id: BranchId
  name: string
  role: string
  /** How many tiers are already bought, 0–2. */
  tier: number
  maxTier: number
  cost: number
  /** What the next tier does, or the last one bought if it is maxed. */
  note: string
  /** False when the other branch was taken, or this one is maxed, or oil is short. */
  affordable: boolean
  open: boolean
}

export interface Selection {
  kind: WardKind
  x: number
  y: number
  branches: BranchOption[]
}

export interface GameState {
  phase: Phase
  /** 1-based. */
  night: number
  nightCount: number
  nightName: string
  nightLede: string
  /** The one new thing this night brings, for the briefing. */
  nightTeaches: string
  /** True on the last night, so the finish screen can mean something. */
  finalNight: boolean
  mode: Mode
  /** §7.2, nightly only. */
  nightlyKey: string
  nightlyModifiers: string[]
  /** True once today's has been attempted — there is no second go. */
  nightlyPlayed: boolean
  streak: number
  bestStreak: number
  /** §8, longroad only. */
  runNight: number
  bestRun: number
  /** The Long Road is locked until the seventh night has been held. */
  longRoadUnlocked: boolean
  /** 0 on a clear night. */
  fog: number
  /** Seconds to the next gust, or 0 on a still night. */
  gustIn: number
  gustWarning: boolean
  wave: number
  waveCount: number
  homesteadHp: number
  homesteadMaxHp: number
  oil: number
  selectedWard: WardId
  canAffordSelected: boolean
  walkersAlive: number
  /** Seconds until the next wave, during a break. */
  breakRemaining: number
  paused: boolean
  helpOpen: boolean
  /** 1 or FAST_FORWARD. */
  speed: number
  /** §11: silent by default. This is off until the player asks for it. */
  audioOn: boolean
  bellyReady: boolean
  /** Seconds until Show Belly is available; 0 when ready. */
  bellyCooldown: number
  bubbleCharges: number
  bubbleMax: number
  karaHp: number
  karaMaxHp: number
  karaState: KaraMode
  /** Seconds left in whatever is holding her; 0 when she is free. */
  karaStateRemaining: number
  /** §4. The toy equipped for this night. */
  toy: ToyId
  /** §4/§9. Toys unlocked with stash. The Rope is free. */
  ownedToys: ToyId[]
  /** §3.4. Committed bond, and what this night has earned but not yet banked. */
  bond: number
  bondTier: number
  pendingBond: number
  /** §9. */
  stash: number
  /** Owed but not yet carried back — she still has to go and get it. */
  stashOwed: number
  fetching: boolean
  /** §3.5. True while a ball is on the ground and she is looking at you. */
  ballOut: boolean
  ballSecondsLeft: number
  /** Non-null while she is away doing something that is not defending the homestead. */
  errand: 'ball' | 'fetch' | null
  /** What stash can buy tonight, already priced against what is owned. */
  shop: { id: string; name: string; detail: string; cost: number; owned: boolean; affordable: boolean }[]
  /** Only true on a night the Rope is equipped — Hold does not otherwise exist. */
  hasHold: boolean
  holdReady: boolean
  holdCooldown: number
  /** Lanterns the Tallow Man has put out, and the longest one has left. */
  lanternsOut: number
  relightIn: number
  /** What the break is counting down to — count of walkers in the coming wave. */
  nextWaveCount: number
  lightUnderCursor: number
  bandUnderCursor: Band
  /** Null when the selected ward can be placed under the cursor. */
  placementBlocker: string | null
  lanternCost: number
  ironCost: number
  /** Radii the player actually gets, which are not the lantern's nominal radius. */
  litRadius: number
  dimRadius: number
  /** The placed ward the player has clicked, or null. */
  selection: Selection | null
}

/**
 * Consult §9 build order, through step 5.
 *
 * Built: the lightmap and its bands · the split roster (lanterns light, iron kills) ·
 * the income floor · fast-forward · Kara's actives · the counterplay pass, which is
 * where the enemies started teaching different lessons instead of scaling.
 *
 * Deliberately absent, because the build order says so: upgrade branches and the toy
 * roster (step 6), nights 2–7 and their bosses (step 7), the Nightly and Long Roads
 * (step 8), and — deferred outright — audio, fog, bond, stash, and hard mode.
 *
 * Render layering: scene → lighting.overlay (multiply) → bloom.output → foreground →
 * vignette.
 */
export class Game {
  private app = new Application()
  private lighting!: LightingSystem
  private scene = new Container()
  /**
   * Everything that stands on the ground: the cabin, Kara, wards, enemies, corpses.
   *
   * Sorted by `zIndex = y` every frame, so anything further down the screen draws in
   * front. Before this the cabin lived in the scene background and every enemy walking
   * up to it drew on top — the recorded session has hooded figures standing at roof
   * height. Painter's algorithm is the only version of this that is right in every case.
   */
  private actors = new Container()
  private foreground = new Container()

  private kara!: Kara
  private smoke!: Smoke
  /** The built world, kept so a generated road can replace it wholesale. */
  private worldScene = new Container()
  private worldEmissive = new Container()
  private worldLights: Light[] = []
  private homestead = new Container()
  private bloom!: Bloom
  private motes!: Motes
  private weather!: Weather
  private audio = new Audio()
  /** §10: once per night, maximum. This is the whole rate limit. */
  private barked = false

  /** §3.4 / §9. Bond, stash, toys and permanent purchases. Survives everything. */
  private progress: Progress = loadProgress()
  /**
   * §3.4, and the consult's §6 exploit note: **bond earned during a night is held here
   * and only committed when the night is held.** Stash commits immediately and is kept on
   * a retry, deliberately; bond is not, or deliberate failure becomes a bond farm — throw
   * the ball, walk into the porch, repeat.
   */
  private pendingBond = 0
  /** §9: one item per three kills. */
  private killsToward = 0
  /** §9: the single most consequential toggle in the game. */
  private fetching = true
  /** §3.4: +8 for finishing a night without her taking a scratch. */
  private karaUnhurt = true
  /** §3.5: the ball drops once a night, at a moment chosen to be inconvenient. */
  private ballDue = false
  private ballAt = 0
  /** Which wave she drops it on. Rolled per night so it is never the same beat twice. */
  private ballWave = 0
  /** §9: feeding is once a night, or bond is just stash with extra steps. */
  private fedTonight = false
  /** §9: stash owed but not yet carried back. She has to actually go and get it. */
  private stashOwed = 0
  private enemies: Enemy[] = []
  private corpses: Corpse[] = []
  private lanterns: Lantern[] = []
  private irons: ColdIron[] = []
  private bubbles: Bubble[] = []
  private bellyLight!: Light
  private selectedWard: WardId = 'lantern'
  private preview = new Graphics()
  /** Separate from the preview: this one carries a transform, that one does not. */
  private highlight = new Graphics()
  /** The placed ward under inspection. Cleared the moment one is placed or destroyed. */
  private selected: Lantern | ColdIron | null = null

  // Starts on the briefing so the player has time to read before anything walks.
  private phase: Phase = 'briefing'
  private nightIndex = 0
  private waveIndex = 0
  private spawnQueue: { at: number; kind: EnemyKind }[] = []
  private elapsed = 0
  private breakTimer = 4
  private homesteadHp = HOMESTEAD_MAX_HP
  private oil = NIGHTS[0].startingOil

  private mode: Mode = 'campaign'
  /** Today's seeded night. Generated once — it does not change while the tab is open. */
  private nightly: NightlyNight = nightlyFor()

  /** §8. The endless run: which night, and the seed its road and bosses came from. */
  private runNight = 8
  private runRng: () => number = () => 0
  private longNight: NightSpec | null = null
  /** Set once the campaign has been held all seven nights — §8 gates endless on it. */
  private campaignCleared = false
  /** §4. The toy for the coming night, chosen on the briefing. */
  private toy: ToyId = 'rope'
  /** Seconds to the next gust. 0 on a still night. */
  private gustTimer = 0
  /** The squall line currently crossing, if any. Null between gusts. */
  private gustBand: { y: number; front: number; spared: Set<Lantern> } | null = null
  /** §3.2 false ear-perks. The Bell Witch plants these; they have no bodies. */
  private phantoms: { x: number; y: number; until: number }[] = []
  private paused = false
  private helpOpen = false
  private speed: number = 1
  private sparks!: Sparks

  private pointer = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }
  private stateHandler: ((s: GameState) => void) | null = null
  private detach: (() => void)[] = []

  /** Set once mount() has finished; until then there is nothing safe to tear down. */
  private ready = false
  private disposed = false

  /**
   * React StrictMode mounts the effect, tears it down, and mounts it again. Because
   * this is async, the teardown lands while `app.init()` is still in flight — and
   * calling `destroy()` on a half-initialized Pixi Application throws, which takes the
   * whole React tree down with it. So init has to check whether it was abandoned while
   * it was awaiting, and destroy() has to keep its hands off an app that never inited.
   */
  async mount(host: HTMLElement) {
    await this.app.init({
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      background: 0x0b1114,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    })

    if (this.disposed) {
      this.app.destroy(true, { children: true })
      return
    }

    host.appendChild(this.app.canvas)

    this.lighting = new LightingSystem(WORLD_WIDTH, WORLD_HEIGHT)

    this.actors.sortableChildren = true

    const built = buildScene(WORLD_WIDTH, WORLD_HEIGHT)
    this.worldScene = built.scene
    this.worldEmissive = built.emissive
    this.worldLights = built.lights
    this.homestead = built.homestead
    this.homestead.zIndex = HOMESTEAD.y
    this.scene.addChild(built.scene, this.actors)
    this.actors.addChild(this.homestead)
    this.smoke = built.smoke

    // The homestead's own windows and porch lantern. The only light the player starts
    // with, and it reaches the last stretch of road only — everything above it is dark
    // until they pay for it.
    for (const light of built.lights) this.lighting.add(light)

    // Window and lantern glow go through the bloom, so light spills the way light does.
    this.bloom = new Bloom(WORLD_WIDTH, WORLD_HEIGHT)
    this.bloom.source.addChild(built.emissive)

    // In the yard, in front of the porch. Her rig's ground plane is y = 0, so placing
    // her above HOMESTEAD.y leaves her standing on air over the deck.
    // Her Show Belly light. Always registered, driven to zero except during the flash,
    // which avoids adding and removing lights from the array mid-frame.
    this.bellyLight = this.lighting.add({
      x: 0,
      y: 0,
      radius: SHOW_BELLY.lightRadius,
      color: 0xfff4e0,
      intensity: 0,
    })

    this.kara = new Kara(HOMESTEAD.x - 175, HOMESTEAD.y + 48)
    this.actors.addChild(this.kara.body)
    // Her white is emissive too — it is the one thing the dark must never take.
    this.bloom.source.addChild(this.kara.markings)

    this.motes = new Motes(WORLD_WIDTH, WORLD_HEIGHT)

    // Hit embers and kill wisps. They live in the bloom source so they glow; wisps
    // arc toward the point under the HUD's oil counter.
    this.sparks = new Sparks({ x: 330, y: 46 })
    this.bloom.source.addChild(this.sparks.gfx)

    // Above the darkness overlay, so the player can see where the pool will land.
    // Fog sits above the darkness overlay with the motes: it is weather in front of the
    // hollow, not paint on it.
    this.weather = new Weather(WORLD_WIDTH, WORLD_HEIGHT)
    this.foreground.addChild(
      this.weather.container,
      this.motes.container,
      this.highlight,
      this.preview,
    )

    this.app.stage.addChild(
      this.scene,
      this.lighting.overlay,
      this.bloom.output,
      this.foreground,
      vignette(WORLD_WIDTH, WORLD_HEIGHT),
    )

    // Pick up where they left off before the first frame runs, so fog and starting oil
    // are the resumed night's and not the First Night's.
    this.load()
    this.oil = this.night.startingOil
    this.lighting.fogDensity = this.night.fog
    this.gustTimer = this.night.wind

    this.bindInput()
    this.app.ticker.add((ticker) => this.tick(Math.min(ticker.deltaMS / 1000, 0.05)))

    this.ready = true
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
      if (this.inputLocked) return
      const p = toWorld(e)
      if (e.button === 2) {
        this.kara.moveTo(p.x, p.y)
        return
      }
      // The cursor is either over a ward you own or it is not, so a left click is never
      // ambiguous: on one, it selects it; anywhere else, it builds and clears the
      // selection. No modal state, and no click that does nothing.
      const hit = this.wardAt(p.x, p.y)
      if (hit) this.selected = hit
      else {
        this.selected = null
        this.placeWard(p.x, p.y)
      }
    }
    const onContext = (e: Event) => e.preventDefault()
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()

      if (this.phase === 'briefing') {
        if (key === ' ' || key === 'enter') {
          e.preventDefault()
          this.beginNight()
        }
        return
      }

      if (key === ' ') {
        e.preventDefault()
        this.setPaused(!this.paused)
      } else if (key === '1') {
        this.selectedWard = 'lantern'
      } else if (key === '2') {
        this.selectedWard = 'iron'
      } else if (key === 'x') {
        this.showBelly()
      } else if (key === 'b') {
        this.blowBubble()
      } else if (key === 'z') {
        this.blanket()
      } else if (key === 't') {
        this.throwBall()
      } else if (key === 'g') {
        this.toggleFetching()
      } else if (key === 'h' && this.kara.loadout.hold) {
        // Only when the Rope is equipped — otherwise H stays the help key it has been.
        this.hold()
      } else if (key === 'f') {
        this.toggleSpeed()
      } else if (key === '?' || key === '/' || key === 'h') {
        this.toggleHelp()
      } else if (key === 'q' || key === 'e') {
        // The two branches of whatever is selected, left and right.
        this.buyUpgrade(key === 'q' ? 0 : 1)
      } else if (key === 'escape') {
        // Escape always means "get me out of this overlay".
        if (this.helpOpen || this.paused) this.resume()
        else this.selected = null
      } else if (key === 'r' && (this.phase === 'failed' || this.phase === 'complete')) {
        this.restart()
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

  /** Audio is off until asked for (§11), and browsers want a gesture regardless. */
  async toggleAudio() {
    if (this.audio.enabled) this.audio.disable()
    else await this.audio.enable()
  }

  get audioOn() {
    return this.audio.enabled
  }

  /** Leaves the briefing and starts the first wave countdown. */
  beginNight() {
    if (this.phase !== 'briefing') return

    if (this.mode === 'nightly') {
      if (alreadyAttempted(this.nightly.key)) return
      // Marked on the way *in*. One attempt has to mean one attempt, and a streak you
      // can reload your way out of is not worth counting.
      markAttempted(this.nightly.key)
    }

    this.phase = 'break'
    this.breakTimer = 4
  }

  /** Help is a pause — it is fine to read it mid-wave. */
  toggleHelp() {
    if (this.phase === 'briefing') return
    this.helpOpen = !this.helpOpen
    this.paused = this.helpOpen
  }

  setPaused(paused: boolean) {
    if (this.phase === 'briefing') return
    this.paused = paused
    if (!paused) this.helpOpen = false
  }

  toggleSpeed() {
    this.speed = this.speed === 1 ? FAST_FORWARD : 1
  }

  /** §3.2 Show Belly. Ignored while the board is frozen. */
  showBelly() {
    if (this.inputLocked) return
    this.kara.showBelly()
  }

  /**
   * §3.2 Bubbles. Blown at the cursor; she chases it. The bubble outlives her arrival,
   * so a trail of them lights a scouting line up the road.
   */
  blowBubble() {
    if (this.inputLocked) return
    const { x, y } = this.pointer
    if (!this.kara.chaseBubble(x, y)) return

    const bubble = new Bubble(x, y, this.lighting)
    this.bubbles.push(bubble)
    this.bloom.source.addChild(bubble.gfx)
  }

  /**
   * §3.2 The Blanket. `Z` puts her under and `Z` takes her out, which is the whole
   * interface: one key, two states, and a three-second floor she will not come out
   * before. Untargetable underneath, and blind — the Bone Dog is why it exists.
   */
  blanket() {
    if (this.inputLocked) return
    this.kara.blanket()
  }

  /**
   * §3.5. Throw the ball she dropped. She goes where the cursor is, which is the point:
   * the player chooses how far out of position the +3 bond costs her.
   */
  throwBall() {
    if (this.inputLocked) return
    this.kara.throwBall(this.pointer.x, this.pointer.y)
  }

  /** §3.2 Hold. Only exists on a night the Rope is equipped. */
  hold() {
    if (this.inputLocked) return
    this.kara.hold()
  }

  /** §4. Chosen on the briefing screen; takes effect when the night starts. */
  chooseToy(toy: ToyId) {
    // Not on the Nightly Road: its loadout is fixed and shared.
    if (this.phase !== 'briefing' || this.mode === 'nightly') return
    this.toy = toy
    this.kara.loadout = loadoutFor(toy)
    this.kara.hp = this.kara.loadout.maxHp
    this.save()
  }

  /**
   * Every overlay needs a way out that does not require knowing a keybind — the tab
   * can auto-pause the game without the player ever having pressed anything.
   */
  resume() {
    this.setPaused(false)
  }

  /**
   * The one button on both end-of-night curtains. A loss replays the night; holding it
   * moves you on. Same key, opposite meanings — which is right, because from the
   * player's side it is always just "carry on".
   */
  restart() {
    // The Nightly Road has no retry and no next — that is the whole shape of it. Both
    // curtains send you back to the campaign, which is the thing you *can* play again.
    if (this.mode === 'nightly') {
      this.mode = 'campaign'
      this.layRoad(AUTHORED_ROAD)
      this.retryNight()
      return
    }

    // §8: a Long Road night held moves the run on; a night lost ends the run, which is
    // what makes the number mean anything. A new run gets a new road.
    if (this.mode === 'longroad') {
      if (this.phase === 'complete') {
        this.runNight += 1
        this.longNight = longRoadNight(this.runNight, this.runRng)
      } else {
        this.beginRun()
      }
      this.retryNight()
      return
    }

    if (this.phase === 'complete') this.nextNight()
    else this.retryNight()
  }

  /** True while the board is frozen and clicks must not reach it. */
  private get inputLocked() {
    return this.paused || this.helpOpen || this.phase === 'briefing'
  }

  selectWard(id: WardId) {
    this.selectedWard = id
  }

  /** The placed ward under a point, lanterns first — their lamps sit above the road. */
  private wardAt(x: number, y: number): Lantern | ColdIron | null {
    for (const l of this.lanterns) if (l.contains(x, y)) return l
    for (const s of this.irons) if (s.contains(x, y)) return s
    return null
  }

  private get selectedKind(): WardKind | null {
    if (!this.selected) return null
    return this.selected instanceof Lantern ? 'lantern' : 'iron'
  }

  /**
   * Buy a tier on the selected ward. `slot` is 0 or 1 — which of the two branches, in
   * the order the HUD lists them — so the caller never has to know a branch id.
   *
   * Cost comes back from the ward rather than being looked up here: `upgrade()` returns
   * 0 when the branch is closed or maxed, which is the one place that rule lives. Paying
   * from a separately-read price would let the two drift and charge for nothing.
   */
  buyUpgrade(slot: number) {
    if (this.inputLocked) return
    const kind = this.selectedKind
    if (!this.selected || !kind) return

    const id = BRANCHES_FOR[kind][slot === 0 ? 0 : 1]
    if (!this.selected.upgrades.canTake(id)) return
    if (this.oil < this.selected.upgrades.nextCost(id)) return

    this.oil -= this.selected.upgrade(id)
  }

  /** What the HUD draws for the selected ward, or null when nothing is selected. */
  private describeSelection(): Selection | null {
    const kind = this.selectedKind
    if (!this.selected || !kind) return null

    const ward = this.selected
    const branches: BranchOption[] = BRANCHES_FOR[kind].map((id) => {
      const def = BRANCHES[id]
      const tier = ward.upgrades.branch === id ? ward.upgrades.tier : 0
      const open = ward.upgrades.canTake(id)
      const cost = ward.upgrades.nextCost(id)
      // Show what you are about to buy — or, if this branch is finished, what you
      // bought. A branch closed because the *other* one was taken still describes its
      // first tier: that is the road not taken, and it should say what it would have been.
      const maxed = ward.upgrades.branch === id && tier >= def.tiers.length
      const shown = def.tiers[maxed ? def.tiers.length - 1 : tier]

      return {
        id,
        name: def.name,
        role: def.role,
        tier,
        maxTier: def.tiers.length,
        cost,
        note: shown.note,
        open,
        affordable: open && this.oil >= cost,
      }
    })

    return { kind, x: ward.x, y: ward.y, branches }
  }

  /** How far along the road a point is, as a path parameter. Hold needs this. */
  private nearestPathT(x: number, y: number): number {
    let best = Infinity
    let at = 0
    for (let i = 0; i < ROAD.length - 1; i++) {
      const a = ROAD[i]
      const b = ROAD[i + 1]
      const abx = b.x - a.x
      const aby = b.y - a.y
      const len2 = abx * abx + aby * aby || 1
      const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / len2))
      const d = Math.hypot(x - (a.x + abx * t), y - (a.y + aby * t))
      if (d < best) {
        best = d
        at = i + t
      }
    }
    return at
  }

  /** The angle of the road segment nearest a point — iron lies along the road bed. */
  private roadAngleAt(x: number, y: number): number {
    let best = Infinity
    let angle = 0
    for (let i = 0; i < ROAD.length - 1; i++) {
      const a = ROAD[i]
      const b = ROAD[i + 1]
      const abx = b.x - a.x
      const aby = b.y - a.y
      const len2 = abx * abx + aby * aby || 1
      const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / len2))
      const px = a.x + abx * t
      const py = a.y + aby * t
      const d = Math.hypot(x - px, y - py)
      if (d < best) {
        best = d
        angle = Math.atan2(aby, abx)
      }
    }
    return angle
  }

  private wardCost(id: WardId): number {
    return id === 'lantern' ? LANTERN.cost : COLD_IRON.cost
  }

  /** Why the selected ward cannot go here, or null if it can. */
  private placementBlocker(x: number, y: number): string | null {
    if (this.phase === 'briefing') return 'read the briefing first'
    // Without this you can spend oil on a frozen board.
    if (this.paused || this.helpOpen) return 'paused'
    if (this.phase === 'failed' || this.phase === 'complete') return 'not now'
    if (this.oil < this.wardCost(this.selectedWard)) return 'not enough oil'
    if (Math.hypot(x - HOMESTEAD.x, y - HOMESTEAD.y) < 70) return 'too close to the homestead'

    if (this.selectedWard === 'lantern') {
      // Overlapping pools is the point; exact stacking is degenerate.
      for (const l of this.lanterns) {
        if (Math.hypot(l.x - x, l.y - y) < LANTERN.minSpacing) return 'too close to another lantern'
      }
    } else {
      for (const s of this.irons) {
        if (Math.hypot(s.x - x, s.y - y) < COLD_IRON.minSpacing) return 'too close to other iron'
      }
    }
    return null
  }

  /**
   * Draws what the player is actually buying. For a lantern: the inner ring is the
   * damageable zone, the outer the edge of visibility. For iron: the strip itself,
   * already snapped to the road's direction.
   */
  private drawPreview() {
    this.preview.clear()

    const { x, y } = this.pointer
    if (this.phase === 'briefing' || this.phase === 'failed' || this.phase === 'complete') return
    if (this.paused) return

    this.drawSelection()

    // Over one of your own wards the click selects rather than builds, so showing a
    // placement ghost there would be a lie about what the next click does.
    if (this.wardAt(x, y)) return

    const blocked = this.placementBlocker(x, y) !== null

    if (this.selectedWard === 'lantern') {
      const litR = LANTERN.radius * reachFraction(LANTERN.intensity, BAND_LIT)
      const dimR = LANTERN.radius * reachFraction(LANTERN.intensity, BAND_DIM)
      const color = blocked ? 0xff8f6b : 0xffc078

      // fix-plan F6: the **lit** ring is the promise the player cares about — it is where
      // the ward can kill — so it carries the weight. The dim ring drops to a hint. The
      // old emphasis was inverted, and every purchase looked smaller than its own preview.
      this.preview
        .circle(x, y, dimR)
        .stroke({ width: 1, color, alpha: blocked ? 0.12 : 0.18 })
        .circle(x, y, litR)
        .fill({ color, alpha: blocked ? 0.04 : 0.09 })
        .circle(x, y, litR)
        .stroke({ width: 1.5, color, alpha: blocked ? 0.4 : 0.75 })
    } else {
      const color = blocked ? 0xff8f6b : 0x9fb8cf
      const angle = this.roadAngleAt(x, y)
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const hl = COLD_IRON.length / 2
      const hw = COLD_IRON.width / 2
      const corners: [number, number][] = [
        [-hl, -hw],
        [hl, -hw],
        [hl, hw],
        [-hl, hw],
      ]
      const pts = corners.map(([cx, cy]) => ({
        x: x + cx * cos - cy * sin,
        y: y + cx * sin + cy * cos,
      }))
      this.preview
        .poly(pts)
        .stroke({ width: 1.5, color, alpha: blocked ? 0.35 : 0.7 })
        .poly(pts)
        .fill({ color, alpha: blocked ? 0.04 : 0.1 })
    }
  }

  /**
   * The selected ward's real footprint — the actual lit ellipse for a lantern, the
   * actual strip for iron. Drawn from the live objects rather than from the base
   * constants, so an upgraded ward shows the player exactly what they bought.
   *
   * It has its own Graphics because a rotated oval is drawn at the origin and placed by
   * transform, and the placement ghost is drawn in world coordinates — sharing one
   * object would drag the ghost across the map with it.
   */
  private drawSelection() {
    const g = this.highlight.clear()
    g.position.set(0, 0)
    g.rotation = 0

    const ward = this.selected
    if (!ward) return

    const gold = 0xffc078

    if (ward instanceof Lantern) {
      const k = reachFraction(LANTERN.intensity, BAND_LIT)
      const rx = ward.light.radius * k
      const ry = (ward.light.radiusY ?? ward.light.radius) * k
      g.ellipse(0, 0, rx, ry)
        .fill({ color: gold, alpha: 0.05 })
        .ellipse(0, 0, rx, ry)
        .stroke({ width: 1.5, color: gold, alpha: 0.55 })
      g.position.set(ward.x, ward.y)
      g.rotation = ward.light.angle ?? 0
      return
    }

    const hl = ward.length / 2
    const hw = COLD_IRON.width / 2
    g.rect(-hl, -hw, ward.length, COLD_IRON.width).stroke({ width: 2, color: gold, alpha: 0.7 })
    g.position.set(ward.x, ward.y)
    g.rotation = ward.angle
  }

  /** Put an enemy on the board. Bosses also hand their self-light to the lightmap. */
  private add(enemy: Enemy) {
    this.enemies.push(enemy)
    this.actors.addChild(enemy.gfx)
    if (enemy instanceof Boss) this.lighting.add(enemy.glow)
  }

  /** Something stands up on a stretch of road that has already been walked. */
  private raise(kind: EnemyKind, pathT: number) {
    const enemy = spawn(kind)
    enemy.seek(pathT)
    this.add(enemy)
  }

  /**
   * §6 Night 5+, rebuilt per fix-plan F1. A gust is a **band that sweeps the map**, not a
   * switch: it takes the lanterns it passes over, in the order it reaches them, and never
   * more than half of them.
   *
   * The band is chosen when the warning starts, so the 1.8s of warning is a real look at
   * which stretch of road is about to go dark — long enough to move Kara toward it.
   */
  private blowWind(dt: number) {
    if (!this.night.wind) {
      this.gustBand = null
      return
    }

    this.gustTimer -= dt

    // Pick the band and show it, a beat before the front arrives.
    if (this.gustTimer <= GUST.warning && !this.gustBand) {
      const y = 140 + Math.random() * (WORLD_HEIGHT - 320)
      // The cap is applied at selection: if this band would take more than half, the
      // lanterns furthest from its centre are spared and never enter the front's path.
      const inBand = this.lanterns
        .filter((l) => Math.abs(l.y - y) <= GUST.halfHeight)
        .sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y))
      const allowed = Math.max(1, Math.floor(this.lanterns.length * GUST.maxShare))
      this.gustBand = { y, front: -120, spared: new Set(inBand.slice(allowed)) }
      this.weather.warn(y, GUST.halfHeight)
    }

    if (this.gustBand) {
      const wasFront = this.gustBand.front
      this.gustBand.front += GUST.sweepSpeed * dt

      for (const lantern of this.lanterns) {
        if (this.gustBand.spared.has(lantern)) continue
        if (Math.abs(lantern.y - this.gustBand.y) > GUST.halfHeight) continue
        // Snuffed exactly as the front passes it, so outages stagger across the map.
        if (lantern.x > wasFront && lantern.x <= this.gustBand.front) {
          lantern.snuff(GUST.duration)
        }
      }

      if (this.gustBand.front > WORLD_WIDTH + 120) this.gustBand = null
    }

    if (this.gustTimer > 0) return
    this.gustTimer = this.night.wind
    this.weather.blow()
  }

  private placeWard(x: number, y: number) {
    if (this.placementBlocker(x, y) !== null) return

    this.oil -= this.wardCost(this.selectedWard)

    if (this.selectedWard === 'lantern') {
      // The road angle is baked in at placement so a later Mirror Back throws its oval
      // down the road rather than across it. A lantern that has to be re-aimed after
      // upgrading would be a puzzle about the UI, not about the road.
      const lantern = new Lantern(x, y, this.roadAngleAt(x, y), this.lighting)
      this.lanterns.push(lantern)
      this.actors.addChild(lantern.gfx)
      this.bloom.source.addChild(lantern.emissive)
    } else {
      const iron = new ColdIron(x, y, this.roadAngleAt(x, y))
      this.irons.push(iron)
      this.actors.addChild(iron.gfx)
    }
  }

  private get night(): NightSpec {
    if (this.mode === 'nightly') return this.nightly
    if (this.mode === 'longroad') return this.longNight ?? NIGHTS[0]
    return NIGHTS[this.nightIndex]
  }

  /**
   * Switch modes. Only from a briefing — a mode is a different night, and swapping one
   * mid-wave would mean rebuilding the board underneath the player.
   */
  setMode(mode: Mode) {
    if (this.phase !== 'briefing' || mode === this.mode) return
    if (mode === 'longroad' && !this.campaignCleared) return

    this.mode = mode
    // Today's night may have rolled over while the tab sat open.
    if (mode === 'nightly') this.nightly = nightlyFor()
    if (mode === 'longroad') this.beginRun()
    else this.layRoad(AUTHORED_ROAD)

    this.retryNight()
  }

  /**
   * §8. A fresh endless run: a new seed, and with it a new road through the hollow.
   *
   * The road is per *run*, not per night — that is the consult's point. A new map is
   * worth more to "one more run" than a new number, and regenerating it every night
   * would mean the player never learns one.
   */
  private beginRun() {
    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0
    this.runRng = mulberry32(seed)
    this.runNight = 8
    this.layRoad(generateRoad(this.runRng, { x: HOMESTEAD.x, y: HOMESTEAD.y + 5 }, AUTHORED_ROAD))
    this.longNight = longRoadNight(this.runNight, this.runRng)
  }

  /**
   * Swap the road under the world and rebuild the scene around it.
   *
   * Only ever called with an empty board. `setRoad` replaces the array's *contents*, so
   * every enemy already holding it as a path keeps a valid reference — but it keeps its
   * path *index* too, which would put it somewhere arbitrary on the new shape.
   */
  private layRoad(points: Vec2[]) {
    if (sameRoad(ROAD, points)) return

    setRoad(points)

    for (const light of this.worldLights) this.lighting.remove(light)
    this.scene.removeChild(this.worldScene)
    this.worldScene.destroy({ children: true })
    this.actors.removeChild(this.homestead)
    this.homestead.destroy({ children: true })
    this.bloom.source.removeChild(this.worldEmissive)
    this.worldEmissive.destroy({ children: true })

    const built = buildScene(WORLD_WIDTH, WORLD_HEIGHT)
    this.worldScene = built.scene
    this.worldEmissive = built.emissive
    this.worldLights = built.lights
    this.homestead = built.homestead
    this.homestead.zIndex = HOMESTEAD.y
    this.smoke = built.smoke

    // Back to the bottom of the scene, under everything that was placed on it.
    this.scene.addChildAt(built.scene, 0)
    this.actors.addChild(this.homestead)
    this.bloom.source.addChildAt(built.emissive, 0)
    for (const light of built.lights) this.lighting.add(light)
  }

  private queueWave(index: number) {
    // §3.5: 2–4s after a wave begins, once a night, and the doc is explicit that the
    // timing must not be fair. The consult flagged the frequency as a playtest question —
    // "once a night is a moment; once a wave is a nag" — so it is once a night, on a
    // wave picked at random rather than always the first.
    if (index === this.ballWave) {
      this.ballDue = true
      this.ballAt = this.elapsed + 2 + Math.random() * 2
    }

    this.spawnQueue = []
    for (const group of this.night.waves[index].groups) {
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push({ at: this.elapsed + group.start + i * group.gap, kind: group.kind })
      }
    }
    // Groups overlap on purpose — a crawler burst lands while the walkers still have
    // your attention — so the queue has to come out in time order, not group order.
    this.spawnQueue.sort((a, b) => a.at - b.at)
    this.phase = 'wave'
  }

  /**
   * §7.1 Normal: replay the current night from wave 1. Oil and wards reset with it.
   *
   * This is also how the *next* night starts — a night is a night, and there is nothing
   * to carry across but the number. When stash and bond land they will be the exception
   * and will have to be threaded through here deliberately.
   */
  private retryNight() {
    // Before anything is destroyed — a selection pointing at a freed ward is a crash.
    this.selected = null

    for (const e of this.enemies) {
      if (e instanceof Boss) this.lighting.remove(e.glow)
      this.actors.removeChild(e.gfx)
      e.gfx.destroy({ children: true })
    }
    this.enemies = []
    this.phantoms = []

    for (const c of this.corpses) {
      this.actors.removeChild(c.gfx)
      c.gfx.destroy({ children: true })
    }
    this.corpses = []

    for (const l of this.lanterns) {
      this.lighting.remove(l.light)
      this.actors.removeChild(l.gfx)
      this.bloom.source.removeChild(l.emissive)
      l.gfx.destroy({ children: true })
      l.emissive.destroy({ children: true })
    }
    this.lanterns = []

    for (const s of this.irons) {
      this.actors.removeChild(s.gfx)
      s.gfx.destroy({ children: true })
    }
    this.irons = []

    for (const b of this.bubbles) {
      this.lighting.remove(b.light)
      this.bloom.source.removeChild(b.gfx)
      b.gfx.destroy({ children: true })
    }
    this.bubbles = []

    // §7.2: the Nightly Road offers a fixed loadout. Everyone gets the same toy, so it
    // is part of the day's puzzle rather than a lever the player pulls.
    const toy = this.mode === 'nightly' ? this.nightly.toy : this.toy
    // §3.4: bond buys the quality of the dog, and it applies from the first spawn.
    this.kara.reset(HOMESTEAD.x - 175, HOMESTEAD.y + 48, toy, tierOf(this.progress.bond))

    this.homesteadHp = HOMESTEAD_MAX_HP
    // §9: every drum of oil bought with stash is a permanent +25, every night.
    this.oil = this.night.startingOil + this.progress.oilUpgrades * 25
    this.fedTonight = false
    this.lighting.fogDensity = this.night.fog
    this.gustTimer = this.night.wind

    // §8. Set before the first spawn, and reset to 1 outside the Long Road so a campaign
    // night after an endless run is not quietly carrying its scaling.
    if (this.mode === 'longroad') {
      setEnemyScale(hpScaleFor(this.runNight), speedScaleFor(this.runNight))
    } else {
      setEnemyScale(1, 1)
    }
    this.waveIndex = 0
    this.spawnQueue = []
    this.breakTimer = 4
    this.barked = false
    // Crickets thin as the nights get worse, and the bed comes back up after last night's
    // bark took it down.
    this.audio.setNight(this.night.n || 1, this.night.fog)

    // §3.4: bond earned in a night that was not held is discarded. Stash is not.
    this.pendingBond = 0
    this.karaUnhurt = true
    this.killsToward = 0
    this.stashOwed = 0
    this.ballDue = false
    this.ballWave = Math.floor(Math.random() * this.night.waves.length)
    // Straight back to the briefing: every night after the first introduces something,
    // and dropping the player into it unread is how a system gets blamed on the game.
    this.phase = 'briefing'
    this.paused = false
    this.helpOpen = false
  }

  /** Advance to the next night, or finish the campaign. */
  private nextNight() {
    if (this.nightIndex >= NIGHTS.length - 1) {
      // §8: holding the seventh is what unlocks the Long Road, and it stays unlocked.
      this.campaignCleared = true
      this.nightIndex = 0
    } else {
      this.nightIndex += 1
    }
    this.save()
    this.retryNight()
  }

  private static readonly SAVE_KEY = 'ghost-road/progress'

  private save() {
    try {
      localStorage.setItem(
        Game.SAVE_KEY,
        JSON.stringify({
          night: this.nightIndex,
          wave: this.waveIndex,
          toy: this.toy,
          cleared: this.campaignCleared,
        }),
      )
    } catch {
      // Private browsing, a full quota, a locked-down work machine. Losing the save is
      // survivable; taking the game down with it is not.
    }
  }

  private load() {
    try {
      const raw = localStorage.getItem(Game.SAVE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { night?: unknown; toy?: unknown; cleared?: unknown }
      const n = typeof parsed.night === 'number' ? parsed.night : 0
      // Clamp rather than trust: the file is user-editable and the roster is not.
      this.nightIndex = Math.max(0, Math.min(NIGHTS.length - 1, Math.floor(n)))
      if (TOYS.some((t) => t.id === parsed.toy)) this.toy = parsed.toy as ToyId
      this.campaignCleared = parsed.cleared === true
    } catch {
      this.nightIndex = 0
    }
  }

  /**
   * §3.4. The night was held, so the escrow pays out — plus the two things that can only
   * be judged at the end of it: resting her, and whether she got through it untouched.
   */
  private commitBond() {
    const earned = this.pendingBond + BOND.rest + (this.karaUnhurt ? BOND.unhurt : 0)
    this.pendingBond = 0
    this.progress.bond = Math.max(0, Math.min(100, this.progress.bond + earned))
    saveProgress(this.progress)
  }

  /** §9. Spend stash between nights. Only from a briefing. */
  buy(id: string) {
    if (this.phase !== 'briefing') return
    const item = SHOP.find((s) => s.id === id)
    if (!item || this.progress.stash < item.cost) return

    if (item.id === 'feed') {
      if (this.fedTonight) return
      this.fedTonight = true
      this.progress.bond = Math.min(100, this.progress.bond + BOND.feed)
    } else if (item.id === 'oil') {
      if (this.progress.oilUpgrades >= MAX_OIL_UPGRADES) return
      this.progress.oilUpgrades += 1
    } else if (item.id.startsWith('toy:')) {
      const toy = item.id.slice(4) as ToyId
      if (this.progress.toys.includes(toy)) return
      this.progress.toys.push(toy)
    }

    this.progress.stash -= item.cost
    saveProgress(this.progress)
  }

  /** §9. Turning fetching off costs progression and buys presence. */
  toggleFetching() {
    this.fetching = !this.fetching
  }

  /** Wipes progress and starts over at the First Night. */
  restartCampaign() {
    this.nightIndex = 0
    this.save()
    this.retryNight()
  }

  private tick(dt: number) {
    const frozen =
      this.paused ||
      this.phase === 'briefing' ||
      this.phase === 'failed' ||
      this.phase === 'complete'

    if (frozen) {
      // The chimney keeps going, and the lamps keep swinging. The house is still lived
      // in, even on the pause screen.
      this.smoke.update(dt)
      for (const lantern of this.lanterns) lantern.animate(dt)
      this.renderPasses(dt)
      this.publish()
      return
    }

    // Fast-forward scales simulation time; the pause and overlay paths above never see it.
    dt *= this.speed

    this.elapsed += dt

    if (this.phase === 'break') {
      this.breakTimer -= dt
      if (this.breakTimer <= 0) this.queueWave(this.waveIndex)
    }

    while (this.spawnQueue.length && this.spawnQueue[0].at <= this.elapsed) {
      const next = this.spawnQueue.shift()!
      this.add(spawn(next.kind))
    }

    this.blowWind(dt)

    for (const lantern of this.lanterns) lantern.animate(dt)

    // The iron does the killing now — but only where the lanterns have made it possible.
    for (const iron of this.irons) {
      for (const hit of iron.update(dt, this.enemies, this.lighting)) {
        this.sparks.burst(hit.x, hit.y)
      }
    }

    // The Tallow Man wants the lanterns and the Bone Dog wants Kara, so an enemy has to
    // be able to see more of the board than the road it is standing on.
    const context: EnemyContext = {
      lighting: this.lighting,
      kara: this.kara,
      lanterns: this.lanterns,
      raise: (kind, pathT) => this.raise(kind, pathT),
      lie: (x, y, seconds) => {
        this.phantoms.push({ x, y, until: this.elapsed + seconds })
      },
    }

    // §3.2 Hold. "Enemies within 90px are slowed 35% and cannot pass" — *cannot pass* is
    // literal, so anything inside the radius is clamped to her point on the road and
    // does not advance past it. She is a wall, which is the only time in this game she
    // stops anything directly.
    const holdT = this.kara.holding ? this.nearestPathT(this.kara.x, this.kara.y) : null
    let straining = false

    if (holdT !== null) {
      for (const enemy of this.enemies) {
        if (Math.hypot(enemy.x - this.kara.x, enemy.y - this.kara.y) > HOLD.radius) continue
        enemy.slowFactor = Math.min(enemy.slowFactor, HOLD.slow)
      }
    }

    for (const enemy of this.enemies) {
      enemy.update(dt, context)

      // Only road traffic. A Bone Dog has left the ruts to come at her and has no
      // meaningful position on the road any more — clamping it would teleport it. It is
      // also not trying to get *past* her, so there is nothing there to hold.
      if (holdT !== null && enemy.onRoad && enemy.pathT > holdT) {
        const near = Math.hypot(enemy.x - this.kara.x, enemy.y - this.kara.y) <= HOLD.radius
        if (near) {
          enemy.seek(holdT - enemy.holdOffset)
          straining = true
        }
      }

      if (enemy.arrived) {
        this.homesteadHp -= enemy.porchDamage
        enemy.hp = 0
        // §10. She has been silent all night and all campaign. Something is on the porch,
        // so it is no longer a warning — it is a verdict, and it fires exactly once.
        if (!this.barked) {
          this.barked = true
          this.audio.bark()
        }
      }
    }

    // It only costs her while something is actually pushing back.
    if (straining) this.kara.strain(dt)

    // Cleanup. Oil is only awarded for kills, not for things that reached the porch.
    // A killed enemy hands its container to a Corpse and falls; one that reached the
    // porch is simply gone, because it walked inside.
    const survivors: Enemy[] = []
    for (const enemy of this.enemies) {
      if (!enemy.dead) {
        survivors.push(enemy)
        continue
      }
      // A boss stops lighting the road the moment it goes down, either way it went.
      if (enemy instanceof Boss) this.lighting.remove(enemy.glow)
      if (enemy.arrived) {
        this.actors.removeChild(enemy.gfx)
        enemy.gfx.destroy({ children: true })
      } else {
        this.oil += OIL_PER_LIT_KILL
        this.sparks.wisp(enemy.x, enemy.y)
        this.corpses.push(new Corpse(enemy.gfx))
        // §9: one item per three kills. It is *owed* here, not banked — she still has to
        // go out into the dark and drag it back, and that trip is the price.
        this.killsToward += 1
        if (this.killsToward >= KILLS_PER_FETCH) {
          this.killsToward = 0
          this.stashOwed += 1
        }
      }
    }
    this.enemies = survivors

    for (const corpse of this.corpses) corpse.update(dt)
    for (const corpse of this.corpses.filter((c) => c.finished)) {
      this.actors.removeChild(corpse.gfx)
      corpse.gfx.destroy({ children: true })
    }
    this.corpses = this.corpses.filter((c) => !c.finished)

    if (this.homesteadHp <= 0) {
      this.homesteadHp = 0
      this.phase = 'failed'
      // Losing is the only thing that resets a streak. An unresolved attempt — a closed
      // laptop, a crashed tab — merely fails to advance it.
      if (this.mode === 'nightly') recordLost(this.nightly.key)
      // §8: the run ends here. The score is the night you did not survive, minus one.
      if (this.mode === 'longroad') saveBest(this.runNight - 1)
    } else if (this.phase === 'wave' && !this.spawnQueue.length && !this.enemies.length) {
      // §9 income floor: clearing a wave pays regardless of how it was cleared.
      this.oil += OIL_PER_WAVE
      // She gets a breather too. Without this there is no way to heal her at all and a
      // bad wave 1 turns the rest of the night into a slow bleed.
      this.kara.rest(KARA.healPerWave)
      this.waveIndex++
      if (this.waveIndex >= this.night.waves.length) {
        this.phase = 'complete'
        if (this.mode === 'nightly') recordHeld(this.nightly.key)
        if (this.mode === 'longroad') saveBest(this.runNight)
        this.commitBond()
      } else {
        this.breakTimer = WAVE_BREAK
        this.phase = 'break'
      }
      // §6: state saves after every wave. It is a game played in short breaks; losing
      // your place because a tab closed is the one failure that has nothing to do with
      // the hollow.
      this.save()
    }

    // What Kara can hear. `soonVisible` asks where each walker will be in
    // EAR_PERK_LEAD seconds and whether the light will have reached it by then — that
    // lookahead is the whole reason her ears mean anything.
    this.phantoms = this.phantoms.filter((p) => p.until > this.elapsed)

    const threats: Threat[] = this.enemies.map((w) => {
      const ahead = w.futurePosition(EAR_PERK_LEAD)
      return {
        x: w.x,
        y: w.y,
        visible: this.lighting.lightAt(w.x, w.y) >= BAND_DIM,
        soonVisible: this.lighting.lightAt(ahead.x, ahead.y) >= BAND_DIM,
      }
    })

    // The Bell Witch's phantoms enter Kara's hearing as ordinary threats: invisible now,
    // about to be visible. She has no way to tell them from the real thing, and neither
    // does the player — which is the entire attack.
    for (const p of this.phantoms) {
      threats.push({ x: p.x, y: p.y, visible: false, soonVisible: true })
    }

    this.kara.update(dt, this.lighting, threats)
    this.tickProgression(dt)

    // Her belly light rides the animation envelope, so the flash is exactly as long as
    // the pose that earns it.
    this.bellyLight.x = this.kara.x
    this.bellyLight.y = this.kara.y - 8
    this.bellyLight.intensity = SHOW_BELLY.lightIntensity * this.kara.bellyGlow

    for (const bubble of this.bubbles) bubble.update(dt)
    for (const bubble of this.bubbles.filter((b) => b.popped)) {
      this.lighting.remove(bubble.light)
      this.bloom.source.removeChild(bubble.gfx)
      bubble.gfx.destroy({ children: true })
    }
    this.bubbles = this.bubbles.filter((b) => !b.popped)

    this.smoke.update(dt)
    // Her tags are how you hear where she is when she is off in the dark (§10).
    this.audio.update(dt, { x: this.kara.x, y: this.kara.y, moving: this.kara.moving }, WORLD_WIDTH)
    this.renderPasses(dt)
    this.publish()
  }

  /**
   * §3.4 / §3.5 / §9. The ledger, and the two things that feed it.
   *
   * Both verbs cost the same currency and it is not oil — it is **her being somewhere
   * else.** That is the whole design of this layer: progression is bought with presence,
   * and the player who wants both has to decide when they can spare her.
   */
  private tickProgression(dt: number) {
    // ── The dropped ball (§3.5) ──────────────────────────────────────────────
    // "Weighted to be inconvenient, i.e. 2–4s after a wave begins. Do not make the
    // timing fair." So it lands while the wave is arriving, not in the quiet before it.
    if (this.ballDue && this.phase === 'wave' && this.elapsed >= this.ballAt) {
      this.ballDue = false
      this.kara.dropBall()
    }

    if (this.kara.ignoredBall) {
      this.kara.ignoredBall = false
      this.pendingBond += BOND.ignoreBall
    }

    // §3.4. "Finish a night with her uninjured" is checked continuously rather than at the
    // end, because she heals between waves — a scratch on wave 1 would otherwise be gone
    // by the time anyone looked.
    if (this.karaUnhurt && this.kara.hp < this.kara.loadout.maxHp) this.karaUnhurt = false

    if (this.kara.wentDown) {
      this.kara.wentDown = false
      this.pendingBond += BOND.down
    }

    // ── Errands finishing ────────────────────────────────────────────────────
    const done = this.kara.finishedErrand
    if (done) {
      this.kara.finishedErrand = null
      if (done === 'ball') {
        this.pendingBond += BOND.throwBall
      } else if (this.stashOwed > 0) {
        // She only banks what she actually carried back.
        this.stashOwed -= 1
        this.progress.stash += 1
        saveProgress(this.progress)
      }
    }

    // ── Fetching (§9) ────────────────────────────────────────────────────────
    // She goes when there is something owed, she is free, and the player has left
    // fetching on. Turning it off costs progression and buys presence.
    if (this.fetching && this.stashOwed > 0 && !this.kara.busy && !this.kara.waitingOnBall) {
      const angle = Math.random() * Math.PI * 2
      // Far enough that the round trip is roughly the doc's six seconds at walk speed.
      const reach = FETCH_SECONDS * 0.5 * this.kara.loadout.walkSpeed
      const x = Math.max(60, Math.min(WORLD_WIDTH - 60, this.kara.x + Math.cos(angle) * reach))
      const y = Math.max(120, Math.min(WORLD_HEIGHT - 40, this.kara.y + Math.sin(angle) * reach))
      this.kara.sendToFetch(x, y)
    }

    void dt
  }

  /**
   * Painter's algorithm over everything standing on the ground. `zIndex = y`, so anything
   * further down the screen draws in front — an enemy on the final approach goes behind
   * the cabin, and Kara in the yard stays in front of it.
   */
  private sortActors() {
    this.kara.body.zIndex = this.kara.y
    for (const enemy of this.enemies) enemy.gfx.zIndex = enemy.y
    for (const corpse of this.corpses) corpse.gfx.zIndex = corpse.gfx.y
    for (const lantern of this.lanterns) lantern.gfx.zIndex = lantern.y
    for (const iron of this.irons) iron.gfx.zIndex = iron.y
  }

  /** Lightmap, bloom, motes, sparks, placement preview — the passes that run every frame. */
  private renderPasses(dt: number) {
    this.sortActors()
    this.lighting.update(this.app.renderer, dt)
    this.weather.update(dt, this.night.fog)
    this.motes.update(dt, (x, y) => this.lighting.lightAt(x, y))
    this.sparks.update(dt)
    this.bloom.update(this.app.renderer)
    this.drawPreview()
  }

  private publish() {
    if (!this.stateHandler) return
    const L = this.lighting.lightAt(this.pointer.x, this.pointer.y)

    const night = this.night
    const record = loadRecord()

    this.stateHandler({
      phase: this.phase,
      mode: this.mode,
      nightlyKey: this.nightly.key,
      nightlyModifiers: this.nightly.modifiers,
      nightlyPlayed: record.attempted === this.nightly.key,
      streak: record.streak,
      bestStreak: record.best,
      runNight: this.runNight,
      bestRun: loadBest(),
      longRoadUnlocked: this.campaignCleared,
      night: night.n,
      nightCount: NIGHTS.length,
      nightName: night.name,
      nightLede: night.lede,
      nightTeaches: night.teaches,
      finalNight: this.nightIndex === NIGHTS.length - 1,
      fog: night.fog,
      gustIn: night.wind ? Math.max(0, this.gustTimer) : 0,
      gustWarning: night.wind > 0 && this.gustTimer > 0 && this.gustTimer <= GUST.warning,
      wave: Math.min(this.waveIndex + 1, night.waves.length),
      waveCount: night.waves.length,
      homesteadHp: Math.max(0, this.homesteadHp),
      homesteadMaxHp: HOMESTEAD_MAX_HP,
      oil: Math.floor(this.oil),
      selectedWard: this.selectedWard,
      canAffordSelected: this.oil >= this.wardCost(this.selectedWard),
      walkersAlive: this.enemies.length,
      breakRemaining: Math.max(0, this.breakTimer),
      paused: this.paused,
      helpOpen: this.helpOpen,
      speed: this.speed,
      audioOn: this.audio.enabled,
      bellyReady: this.kara.bellyReady,
      bellyCooldown: this.kara.bellyCooldownRemaining,
      bubbleCharges: this.kara.bubbleCharges,
      bubbleMax: BUBBLES.maxCharges,
      karaHp: Math.ceil(this.kara.hp),
      karaMaxHp: this.kara.loadout.maxHp,
      toy: this.toy,
      ownedToys: this.progress.toys,
      bond: this.progress.bond,
      bondTier: tierOf(this.progress.bond),
      pendingBond: this.pendingBond,
      stash: this.progress.stash,
      stashOwed: this.stashOwed,
      fetching: this.fetching,
      ballOut: this.kara.waitingOnBall,
      ballSecondsLeft: this.kara.ballSecondsLeft,
      errand: this.kara.errandKind,
      shop: SHOP.map((s) => {
        const owned =
          (s.id === 'feed' && this.fedTonight) ||
          (s.id === 'oil' && this.progress.oilUpgrades >= MAX_OIL_UPGRADES) ||
          (s.id.startsWith('toy:') && this.progress.toys.includes(s.id.slice(4) as ToyId))
        return {
          ...s,
          owned,
          affordable: !owned && this.progress.stash >= s.cost,
        }
      }),
      hasHold: this.kara.loadout.hold,
      holdReady: this.kara.holdReady || this.kara.holding,
      holdCooldown: this.kara.holdCooldownRemaining,
      karaState: this.kara.state,
      karaStateRemaining: this.kara.stateRemaining,
      lanternsOut: this.lanterns.filter((l) => l.snuffed).length,
      relightIn: this.lanterns.reduce((m, l) => Math.max(m, l.relightIn), 0),
      nextWaveCount:
        this.phase === 'break' && this.waveIndex < night.waves.length
          ? night.waves[this.waveIndex].groups.reduce((n, g) => n + g.count, 0)
          : 0,
      lightUnderCursor: L,
      bandUnderCursor: bandOf(L),
      placementBlocker: this.placementBlocker(this.pointer.x, this.pointer.y),
      lanternCost: LANTERN.cost,
      ironCost: COLD_IRON.cost,
      litRadius: LANTERN.radius * reachFraction(LANTERN.intensity, BAND_LIT),
      dimRadius: LANTERN.radius * reachFraction(LANTERN.intensity, BAND_DIM),
      selection: this.describeSelection(),
    })
  }

  destroy() {
    this.disposed = true

    for (const off of this.detach) off()
    this.detach = []

    // Still initializing — mount() sees `disposed` when it resumes and cleans up there.
    if (!this.ready) return

    this.audio.destroy()
    this.bloom.destroy()
    this.lighting.destroy()
    this.app.destroy(true, { children: true })
  }
}
