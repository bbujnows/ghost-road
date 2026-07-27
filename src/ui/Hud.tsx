import type { GameState } from '../game/Game'
import { LANTERN } from '../game/balance'
import './hud.css'

const BAND_LABEL = {
  dark: 'dark · untouchable',
  dim: 'dim · visible, still safe',
  lit: 'lit · damageable',
  bright: 'bright · +25% damage',
} as const

export function Hud({ state }: { state: GameState | null }) {
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
        </div>

        <div className="panel">
          <span className="label">Lamp oil</span>
          <span className={`value oil ${state.canAffordLantern ? '' : 'short'}`}>{state.oil}</span>
        </div>

        <div className="panel">
          <span className="label">On the road</span>
          <span className="value">{state.walkersAlive}</span>
        </div>
      </div>

      <div className="hud-bottom">
        <div className="panel">
          <span className="label">Lantern Post · {LANTERN.cost} oil</span>
          <span className="hint">
            {state.placementBlocker ? (
              <span className="blocked">{state.placementBlocker}</span>
            ) : (
              'Left click to place · right click to send Kara · Space to pause'
            )}
          </span>
          <span className={`probe band-${state.bandUnderCursor}`}>
            under cursor {state.lightUnderCursor.toFixed(2)} — {BAND_LABEL[state.bandUnderCursor]}
          </span>
        </div>
      </div>

      {state.phase === 'break' && state.breakRemaining > 0 && (
        <div className="banner">Next wave in {Math.ceil(state.breakRemaining)}</div>
      )}

      {state.paused && <div className="veil">Paused</div>}

      {state.phase === 'failed' && (
        <div className="veil">
          <div className="veil-body">
            <p>The hollow took the homestead.</p>
            <p className="veil-sub">Press R to hold the night again.</p>
          </div>
        </div>
      )}

      {state.phase === 'complete' && (
        <div className="veil">
          <div className="veil-body">
            <p>Dawn.</p>
            <p className="veil-sub">She stayed on the porch all night.</p>
          </div>
        </div>
      )}
    </div>
  )
}
