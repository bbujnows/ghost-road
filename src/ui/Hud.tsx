import type { GameState } from '../game/Game'
import './hud.css'

/**
 * Placeholder overlay. It proves the React HUD layer composites over the Pixi canvas
 * without eating pointer events, and it reads out the lightmap while the engine is
 * being built.
 *
 * The real HUD — night, waves, Kara's status, ward selection, the economy — waits on
 * the design doc, because all of those are things the design has to decide first.
 */
export function Hud({ state }: { state: GameState | null }) {
  if (!state) return null

  return (
    <div className="hud">
      <div className="panel">
        <span className="label">Skeleton build</span>
        <span className="hint">Click to walk Kara · Space to pause</span>
        <span className="probe">light under cursor {state.lightUnderCursor.toFixed(2)}</span>
      </div>

      {state.paused && <div className="veil">Paused</div>}
    </div>
  )
}
