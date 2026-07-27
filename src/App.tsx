import { useEffect, useRef, useState } from 'react'
import { Game } from './game/Game'
import type { GameState } from './game/Game'
import { Hud } from './ui/Hud'
import './App.css'

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<GameState | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const game = new Game()
    let cancelled = false

    game.onState((s) => {
      if (!cancelled) setState(s)
    })

    game.mount(host).catch((err) => console.error('Ghost Road failed to start', err))

    return () => {
      cancelled = true
      game.destroy()
    }
  }, [])

  return (
    <div className="app">
      <div className="stage">
        <div className="canvas-host" ref={hostRef} />
        <Hud state={state} />
      </div>
    </div>
  )
}
