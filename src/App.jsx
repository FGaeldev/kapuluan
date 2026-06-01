/**
 * App.jsx
 *
 * Purpose:  Root shell. Loads game data on mount, then renders
 *           map canvas and UI overlay.
 *
 * Dependencies: React, GameCanvas, UIOverlay, loadGameData
 */

import { useEffect } from 'react'
import GameCanvas from './components/map/GameCanvas'
import UIOverlay from './components/ui/UIOverlay'
import { loadGameData } from './data/loadGameData'
import './index.css'

function App() {
  // Load all JSON game data once on mount
  useEffect(() => {
    loadGameData()
  }, [])

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-stone-950">
      <GameCanvas />
      <UIOverlay />
    </div>
  )
}

export default App