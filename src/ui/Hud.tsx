import type { GameState } from '../game/Game'
import { OIL_PER_LIT_KILL, OIL_PER_WAVE, ROAD_WALKER } from '../game/balance'
import './hud.css'

const BAND_LABEL = {
  dark: 'dark · invisible, cannot be hurt',
  dim: 'dim · you can see it, not hurt it',
  lit: 'lit · your lanterns can kill it',
} as const

const CONTROLS = [
  { key: '1 / 2', label: 'Select ward' },
  { key: 'Left click', label: 'Place it' },
  { key: 'Right click', label: 'Send Kara' },
  { key: 'X', label: 'Show Belly' },
  { key: 'B', label: 'Bubble at cursor' },
  { key: 'F', label: 'Fast-forward' },
  { key: 'Space', label: 'Pause' },
  { key: '?', label: 'Help' },
]

/**
 * Kara's cooldowns, unlike her Ear-Perk, must be on screen — a resource the player
 * cannot count is a resource they will not spend.
 */
function KaraPanel({ state }: { state: GameState }) {
  return (
    <div className="panel kara-panel">
      <span className="label">Kara</span>

      <div className={`ability ${state.bellyReady ? 'ready' : 'cooling'}`}>
        <kbd>X</kbd>
        <span className="ability-name">Show Belly</span>
        <span className="ability-state">
          {state.bellyReady ? 'ready' : `${Math.ceil(state.bellyCooldown)}s`}
        </span>
      </div>

      <div className={`ability ${state.bubbleCharges > 0 ? 'ready' : 'cooling'}`}>
        <kbd>B</kbd>
        <span className="ability-name">Bubbles</span>
        <span className="pips">
          {Array.from({ length: state.bubbleMax }, (_, i) => (
            <span key={i} className={`pip ${i < state.bubbleCharges ? 'full' : ''}`} />
          ))}
        </span>
      </div>
    </div>
  )
}

export interface HudProps {
  state: GameState | null
  onBegin: () => void
  onToggleHelp: () => void
  onResume: () => void
  onRestart: () => void
  onToggleSpeed: () => void
  onSelectWard: (id: 'lantern' | 'iron') => void
}

/**
 * Every overlay in this game must have a visible way out. The tab can auto-pause
 * without the player having pressed anything, so "press Space" is not an exit — it is
 * a shortcut for people who already know it.
 */
function Curtain({
  title,
  sub,
  action,
  hint,
  onAction,
}: {
  title: string
  sub?: string
  action: string
  hint?: string
  onAction: () => void
}) {
  return (
    <div className="veil">
      <div className="curtain">
        <p className="curtain-title">{title}</p>
        {sub && <p className="veil-sub">{sub}</p>}
        <button type="button" className="primary" onClick={onAction}>
          {action}
        </button>
        {hint && <p className="footnote">{hint}</p>}
      </div>
    </div>
  )
}

function Rules({ state }: { state: GameState }) {
  return (
    <ol className="rules">
      <li>
        <strong>Things come up the road.</strong> Anything that reaches the porch takes a bite out
        of the homestead. Lose it all and the night is over.
      </li>
      <li>
        <strong>The dark protects them.</strong> Out in the unlit road they are invisible and
        cannot be hurt at all. Light is not scenery here — it is what makes ground fightable.
      </li>
      <li>
        <strong>Lanterns don't kill. Iron does.</strong> A lantern ({state.lanternCost} oil)
        lights a stretch of road — the <span className="ring-lit">inner ring</span> is where its
        light is strong enough to fight in. A board of{' '}
        <span className="ring-iron">cold iron nails</span> ({state.ironCost} oil) lies along the
        road bed and burns whatever walks it — <em>but only in light</em>. You need both, and
        where they overlap is where the road bites.
      </li>
      <li>
        <strong>Every wave you survive pays {OIL_PER_WAVE} oil</strong>, and each kill in the
        light adds {OIL_PER_LIT_KILL} more. Anything that reaches the porch pays nothing.
      </li>
      <li>
        <strong>Kara works in the dark</strong> — the only thing that does. Right click sends her.
        Watch her ears: she lifts them about two seconds before something becomes visible, and
        she turns to face it. That tell is the game's radar, and it is the only one you get.
      </li>
      <li>
        <strong>Press X to Show Belly.</strong> She flops onto her back and her white belly
        throws light across the area — enough to make a whole clump of them killable for a
        moment, anywhere on the map. She is helpless for two seconds afterward.
      </li>
      <li>
        <strong>Press B to blow a bubble</strong> at your cursor. She chases it at nearly twice
        her walking speed, and the bubble drifts and glows — enough light to reveal what's out
        there, never enough to kill it.
      </li>
    </ol>
  )
}

export function Hud({
  state,
  onBegin,
  onToggleHelp,
  onResume,
  onRestart,
  onToggleSpeed,
  onSelectWard,
}: HudProps) {
  if (!state) return null

  const hpPct = (state.homesteadHp / state.homesteadMaxHp) * 100

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="panel">
          <span className="label">First Night</span>
          <span className="value">
            Wave {state.wave} / {state.waveCount}
          </span>
        </div>

        <div className="panel">
          <span className="label">Homestead</span>
          <div className="meter">
            <div className="meter-fill home" style={{ width: `${hpPct}%` }} />
          </div>
          <span className="sub">{state.homesteadHp} left</span>
        </div>

        <div className="panel">
          <span className="label">Lamp oil</span>
          <span className={`value oil ${state.canAffordSelected ? '' : 'short'}`}>{state.oil}</span>
          <span className="sub">
            {state.canAffordSelected
              ? 'enough for the selected ward'
              : `selected ward needs ${state.selectedWard === 'lantern' ? state.lanternCost : state.ironCost}`}
          </span>
        </div>

        <div className="panel">
          <span className="label">On the road</span>
          <span className="value">{state.walkersAlive}</span>
          <span className="sub">{ROAD_WALKER.hp} hp each</span>
        </div>

        <div className="top-buttons">
          <button
            type="button"
            className={`speed-btn ${state.speed > 1 ? 'active' : ''}`}
            onClick={onToggleSpeed}
            title="Fast-forward (F)"
          >
            {state.speed > 1 ? '2×' : '1×'}
          </button>
          <button type="button" className="help-btn" onClick={onToggleHelp}>
            ?
          </button>
        </div>
      </div>

      <div className="hud-bottom">
        <div className="panel wards">
          <div
            className={`ward ${state.selectedWard === 'lantern' ? 'selected' : ''}`}
            onClick={() => onSelectWard('lantern')}
          >
            <kbd>1</kbd>
            <span className="ward-name">Lantern Post</span>
            <span className="ward-role">light</span>
            <span className="ward-cost">{state.lanternCost}</span>
          </div>
          <div
            className={`ward ${state.selectedWard === 'iron' ? 'selected' : ''}`}
            onClick={() => onSelectWard('iron')}
          >
            <kbd>2</kbd>
            <span className="ward-name">Cold Iron</span>
            <span className="ward-role">damage, in light</span>
            <span className="ward-cost">{state.ironCost}</span>
          </div>
          <span className="hint">
            {state.placementBlocker ? (
              <span className="blocked">{state.placementBlocker}</span>
            ) : (
              'Click to place it here'
            )}
          </span>
          <span className={`probe band-${state.bandUnderCursor}`}>
            under cursor {state.lightUnderCursor.toFixed(2)} — {BAND_LABEL[state.bandUnderCursor]}
          </span>
        </div>

        <KaraPanel state={state} />

        <div className="panel controls">
          {CONTROLS.map((c) => (
            <div key={c.key} className="control">
              <kbd>{c.key}</kbd>
              <span>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {state.phase === 'break' && state.breakRemaining > 0 && (
        <div className="banner">
          Next wave in {Math.ceil(state.breakRemaining)}
          {state.nextWaveCount > 0 && (
            <span className="banner-detail"> — {state.nextWaveCount} coming down the road</span>
          )}
        </div>
      )}

      {state.phase === 'briefing' && (
        <div className="veil">
          <div className="sheet">
            <p className="eyebrow">Ghost Road · First Night</p>
            <h1>The road has been quiet for forty years.</h1>
            <p className="lede">It is not quiet tonight.</p>
            <Rules state={state} />
            <button type="button" className="primary" onClick={onBegin}>
              Hold the night
            </button>
            <p className="footnote">or press Space</p>
          </div>
        </div>
      )}

      {state.helpOpen && (
        <div className="veil">
          <div className="sheet">
            <p className="eyebrow">How to hold the night</p>
            <Rules state={state} />
            <div className="control-grid">
              {CONTROLS.map((c) => (
                <div key={c.key} className="control">
                  <kbd>{c.key}</kbd>
                  <span>{c.label}</span>
                </div>
              ))}
              <div className="control">
                <kbd>R</kbd>
                <span>Retry, after a loss</span>
              </div>
            </div>
            <button type="button" className="primary" onClick={onToggleHelp}>
              Back to it
            </button>
          </div>
        </div>
      )}

      {state.paused && !state.helpOpen && state.phase !== 'failed' && state.phase !== 'complete' && (
        <Curtain
          title="Paused"
          sub="The road waits."
          action="Resume"
          hint="or press Space"
          onAction={onResume}
        />
      )}

      {state.phase === 'failed' && (
        <Curtain
          title="The hollow took the homestead."
          sub="Kara is fine. She always is."
          action="Hold the night again"
          hint="or press R"
          onAction={onRestart}
        />
      )}

      {state.phase === 'complete' && (
        <Curtain
          title="Dawn."
          sub="She stayed on the porch all night."
          action="Hold it again"
          hint="or press R"
          onAction={onRestart}
        />
      )}
    </div>
  )
}
