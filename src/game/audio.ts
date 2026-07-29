/**
 * Audio (design doc §10).
 *
 * **The whole of this file exists to serve four hundred milliseconds.** Everything here —
 * the wind, the crickets, the creek, her tags on the gravel — is built so that when it
 * all stops at once, the player's nervous system registers the absence before the sound
 * arrives. Seven nights of a silent dog is what buys those four hundred milliseconds.
 *
 * Rules taken from §10 and not negotiable:
 *
 *  - **Enemies are silent.** No screeches, no roars, no cues on spawn. A player straining
 *    to hear is a player who will be destroyed by a loud noise.
 *  - **Kara is audible.** Her collar tags are panned to her position and attenuated with
 *    distance — the audio counterpart of her white paws, and the reason she can be
 *    off-screen without being lost.
 *  - **The bark fires once per night, only when something has physically reached the
 *    homestead.** It is never a warning. It is a verdict.
 *  - **Silent by default** (§11). Audio must be explicitly enabled, and browsers require a
 *    gesture anyway. It is a game played at a desk.
 *
 * Everything is synthesised. No asset pipeline, no network fetch — a strict CSP would
 * block the latter and the former does not exist in this project.
 */

/** §10: the bed sits here and stays here. */
const AMBIENT_GAIN = 0.16
/** §10 step 4: ambient returns 6 dB quieter after the bark and stays down. */
const AFTER_BARK = 0.5
/** §10 step 1: every channel to −60 dB. */
const DUCKED = 0.001
/** §10 step 1: how long the world stops before she barks. */
const SILENCE = 0.4

const dbToGain = (db: number) => Math.pow(10, db / 20)

export class Audio {
  private ctx: AudioContext | null = null

  private master!: GainNode
  /** Wind, crickets, creek. Ducked for the bark and left quieter afterwards. */
  private bed!: GainNode
  /** Her tags and paws. Ducked with the bed — the silence has to be total. */
  private dog!: GainNode
  /** The bark alone. Never ducked; it is the thing the ducking is for. */
  private voice!: GainNode

  private noise!: AudioBuffer
  private cricketTimer = 0
  private stepTimer = 0
  /** 1 on the First Night, falling toward 0 as the hollow empties out. */
  private cricketDensity = 1
  /** Reduced permanently once she has barked, per §10 step 4. */
  private bedLevel = 1

  get enabled() {
    return this.ctx !== null && this.ctx.state === 'running'
  }

  /**
   * Must be called from a user gesture. Silent by default is a design rule (§11), not
   * only a browser one, so nothing here is created until the player asks for it.
   */
  async enable() {
    if (this.ctx) {
      await this.ctx.resume()
      return
    }

    const ctx = new AudioContext()
    this.ctx = ctx

    this.master = ctx.createGain()
    this.master.gain.value = 0.9
    this.master.connect(ctx.destination)

    this.bed = ctx.createGain()
    this.bed.gain.value = AMBIENT_GAIN
    this.bed.connect(this.master)

    this.dog = ctx.createGain()
    this.dog.gain.value = 1
    this.dog.connect(this.master)

    this.voice = ctx.createGain()
    this.voice.gain.value = 1
    this.voice.connect(this.master)

    this.noise = this.makeNoise(ctx)
    this.startWind()
    this.startCreek()

    await ctx.resume()
  }

  disable() {
    void this.ctx?.suspend()
  }

  /** Two seconds of brown-ish noise, looped. Reused by everything that needs air. */
  private makeNoise(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      // Integrate toward brown noise: heavier, more like moving air than hiss.
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.2
    }
    return buffer
  }

  /** Wind in the ridge pines: filtered noise with a slow breathing cutoff. */
  private startWind() {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 420
    filter.Q.value = 0.6

    const swell = ctx.createGain()
    swell.gain.value = 0.5

    // Two detuned LFOs so the gusting never finds a rhythm the ear can predict.
    for (const [rate, depth] of [
      [0.06, 220],
      [0.017, 130],
    ]) {
      const lfo = ctx.createOscillator()
      lfo.frequency.value = rate
      const amp = ctx.createGain()
      amp.gain.value = depth
      lfo.connect(amp).connect(filter.frequency)
      lfo.start()
    }

    src.connect(filter).connect(swell).connect(this.bed)
    src.start()
  }

  /** The creek below the yard. Steady, high, and almost subliminal. */
  private startCreek() {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true

    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 2600

    const g = ctx.createGain()
    g.gain.value = 0.11

    src.connect(hp).connect(g).connect(this.bed)
    src.start()
  }

  /**
   * One cricket. §10: they thin out as the nights get worse, which is the only place the
   * bed carries information — a quiet hollow is a bad sign before anything is on screen.
   */
  private cricket() {
    const ctx = this.ctx!
    const now = ctx.currentTime
    const base = 3800 + Math.random() * 1400

    // A chirp is a short burst of pulses, not a tone.
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.035
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = base

      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.05, t + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)

      const pan = ctx.createStereoPanner()
      pan.pan.value = Math.random() * 2 - 1

      osc.connect(g).connect(pan).connect(this.bed)
      osc.start(t)
      osc.stop(t + 0.04)
    }
  }

  /**
   * Her collar tags. Panned to where she is and quieter the further away she is — §10's
   * audio counterpart to her white paws.
   */
  private jingle(pan: number, distance: number) {
    const ctx = this.ctx!
    const now = ctx.currentTime
    const level = Math.max(0, 1 - distance / 900) * 0.16
    if (level <= 0.005) return

    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, pan))
    panner.connect(this.dog)

    // Two small discs against each other: inharmonic partials, very short.
    for (const [freq, amp, decay] of [
      [5200, 1, 0.09],
      [7100, 0.6, 0.07],
      [3900, 0.45, 0.11],
    ]) {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = freq * (0.97 + Math.random() * 0.06)

      const g = ctx.createGain()
      g.gain.setValueAtTime(0, now)
      g.gain.linearRampToValueAtTime(level * amp, now + 0.002)
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay)

      osc.connect(g).connect(panner)
      osc.start(now)
      osc.stop(now + decay + 0.02)
    }
  }

  /** A paw on gravel. Barely there; it exists so the tags have something to sit on. */
  private step(pan: number, distance: number) {
    const ctx = this.ctx!
    const now = ctx.currentTime
    const level = Math.max(0, 1 - distance / 900) * 0.08
    if (level <= 0.004) return

    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = 1.6

    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1400
    bp.Q.value = 0.9

    const g = ctx.createGain()
    g.gain.setValueAtTime(level, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.055)

    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, pan))

    src.connect(bp).connect(g).connect(panner).connect(this.dog)
    src.start(now, Math.random() * 1.5)
    src.stop(now + 0.07)
  }

  /** Crickets thin as the nights get worse. `night` is 1-based; fog deepens the effect. */
  setNight(night: number, fog: number) {
    this.cricketDensity = Math.max(0, 1 - (night - 1) * 0.14 - fog * 0.35)
    this.bedLevel = 1
    if (this.ctx) this.bed.gain.setTargetAtTime(AMBIENT_GAIN, this.ctx.currentTime, 0.4)
  }

  /**
   * Per frame. `moving` drives her tags, which is the point: a dog standing still is a
   * dog you cannot hear, and stillness already means something in this game.
   */
  update(dt: number, kara: { x: number; y: number; moving: boolean }, width: number) {
    if (!this.enabled) return

    this.cricketTimer -= dt
    if (this.cricketTimer <= 0) {
      this.cricketTimer = 0.4 + Math.random() * 1.6
      if (Math.random() < this.cricketDensity) this.cricket()
    }

    if (!kara.moving) return

    this.stepTimer -= dt
    if (this.stepTimer > 0) return
    this.stepTimer = 0.26

    const pan = (kara.x / width) * 2 - 1
    // Distance from the middle of the porch, which is where the player's attention sits.
    const distance = Math.hypot(kara.x - width / 2, kara.y - 640)
    this.step(pan, distance)
    // Not every footfall rings the tags. A dog's collar is irregular.
    if (Math.random() < 0.7) this.jingle(pan, distance)
  }

  /**
   * §10 The Bark. Once per night, and only when something has physically reached the
   * homestead — so it is never a warning, it is a verdict.
   *
   * 1. 400ms of total silence, every channel to −60 dB. Nothing about the visuals changes.
   * 2. The bark, peaking ~15 dB above anything else in the game.
   * 3. Two seconds of ringing tail, as if the player's ears are recovering.
   * 4. Ambient returns 6 dB quieter and stays there.
   *
   * **The silence is the trick, not the bark.** Do not shorten it.
   */
  bark() {
    if (!this.enabled) return
    const ctx = this.ctx!
    const now = ctx.currentTime
    const at = now + SILENCE

    // 1. Everything stops. Fast enough to read as a cut, not a fade.
    this.bed.gain.cancelScheduledValues(now)
    this.bed.gain.setTargetAtTime(DUCKED, now, 0.012)
    this.dog.gain.cancelScheduledValues(now)
    this.dog.gain.setTargetAtTime(DUCKED, now, 0.012)

    // 2. The bark. A glottal pulse with a hard pitch drop, shaped by two formants, with a
    // noise transient on the front — which is most of what makes a bark read as a bark.
    const body = ctx.createGain()
    body.gain.value = dbToGain(-3)
    body.connect(this.voice)

    const f1 = ctx.createBiquadFilter()
    f1.type = 'bandpass'
    f1.frequency.value = 900
    f1.Q.value = 2.2
    f1.connect(body)

    const f2 = ctx.createBiquadFilter()
    f2.type = 'bandpass'
    f2.frequency.value = 2050
    f2.Q.value = 2.8
    const f2g = ctx.createGain()
    f2g.gain.value = 0.5
    f2.connect(f2g).connect(body)

    for (const type of ['sawtooth', 'square'] as OscillatorType[]) {
      const osc = ctx.createOscillator()
      osc.type = type
      osc.frequency.setValueAtTime(430, at)
      osc.frequency.exponentialRampToValueAtTime(190, at + 0.13)

      const env = ctx.createGain()
      env.gain.setValueAtTime(0, at)
      env.gain.linearRampToValueAtTime(type === 'sawtooth' ? 0.9 : 0.35, at + 0.006)
      env.gain.exponentialRampToValueAtTime(0.28, at + 0.07)
      env.gain.exponentialRampToValueAtTime(0.0001, at + 0.24)

      osc.connect(env)
      env.connect(f1)
      env.connect(f2)
      osc.start(at)
      osc.stop(at + 0.3)
    }

    const transient = ctx.createBufferSource()
    transient.buffer = this.noise
    const th = ctx.createBiquadFilter()
    th.type = 'highpass'
    th.frequency.value = 1100
    const tg = ctx.createGain()
    tg.gain.setValueAtTime(0.5, at)
    tg.gain.exponentialRampToValueAtTime(0.0001, at + 0.05)
    transient.connect(th).connect(tg).connect(body)
    transient.start(at, Math.random())
    transient.stop(at + 0.06)

    // 3. The ringing. A thin high band left behind, decaying over two seconds.
    const ring = ctx.createBufferSource()
    ring.buffer = this.noise
    ring.loop = true
    const rf = ctx.createBiquadFilter()
    rf.type = 'bandpass'
    rf.frequency.value = 4200
    rf.Q.value = 12
    const rg = ctx.createGain()
    rg.gain.setValueAtTime(0, at + 0.02)
    rg.gain.linearRampToValueAtTime(0.09, at + 0.06)
    rg.gain.exponentialRampToValueAtTime(0.0001, at + 2.1)
    ring.connect(rf).connect(rg).connect(this.voice)
    ring.start(at)
    ring.stop(at + 2.2)

    // 4. The hollow comes back quieter than it was, and stays that way.
    this.bedLevel = AFTER_BARK
    this.bed.gain.setTargetAtTime(AMBIENT_GAIN * AFTER_BARK, at + 0.35, 0.8)
    this.dog.gain.setTargetAtTime(1, at + 0.35, 0.8)
  }

  /** For the HUD, so the bed level can be shown to have dropped. */
  get quieted() {
    return this.bedLevel < 1
  }

  destroy() {
    void this.ctx?.close()
    this.ctx = null
  }
}
