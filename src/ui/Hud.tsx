import type { GameState } from '../game/Game'
import { OIL_PER_LIT_KILL, ROAD_WALKER } from '../game/balance'
import './hud.css'

const BAND_LABEL = {
  dark: 'dark · invisible, cannot be hurt',
  dim: 'dim · you can see it, not hurt it',
  lit: 'lit · your lanterns can kill it',
  bright: 'bright · +25% damage',
} as const

const CONTROLS = [
  { key: 'Left click', label: 'Place a lantern' },
  { key: 'Right click', label: 'Send Kara' },
  { key: 'Space', label: 'Pause' },
  { key: '?', label: 'Help' },
]

export interface HudProps {
  state: GameState | null
  onBegin: () => void
  onToggleHelp: () => void
  onResume: () => void
  onRestart: () => void
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
        cannot be hurt at all. Light is not scenery here — it is the weapon.
      </li>
      <li>
        <strong>A lantern costs {state.lanternCost} oil.</strong> Its glow is wider than its reach:
        the <span className="ring-lit">inner ring</span> is where it can actually kill, the{' '}
        <span className="ring-dim">outer ring</span> is only where you can see. Aim the inner ring
        at the road.
      </li>
      <li>
        <strong>Overlap two lanterns</strong> and the ground between them burns brighter — anything
        standing there takes 25% more damage.
      </li>
      <li>
        <strong>Kills in the light pay {OIL_PER_LIT_KILL} oil.</strong> Anything that reaches the
        porch pays nothing. You fund the next lantern by earning it.
      </li>
      <li>
        <strong>Kara can't help yet.</strong> Right click walks her anywhere, and she is the one
        thing the dark does not hide — but her abilities aren't built. For now she just keeps you
        company.
      </li>
    </ol>
  )
}

export function Hud({ state, onBegin, onToggleHelp, onResume, onRestart }: HudProps) {
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
          <span className={`value oil ${state.canAffordLantern ? '' : 'short'}`}>{state.oil}</span>
          <span className="sub">
            {state.canAffordLantern
              ? `${Math.floor(state.oil / state.lanternCost)} lantern(s)`
              : `need ${state.lanternCost}`}
          </span>
        </div>

        <div className="panel">
          <span className="label">On the road</span>
          <span className="value">{state.walkersAlive}</span>
          <span className="sub">{ROAD_WALKER.hp} hp each</span>
        </div>

        <button type="button" className="help-btn" onClick={onToggleHelp}>
          ?
        </button>
      </div>

      <div className="hud-bottom">
        <div className="panel">
          <span className="label">Lantern Post · {state.lanternCost} oil</span>
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
        <div className="banner">Next wave in {Math.ceil(state.breakRemaining)}</div>
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
