/**
 * UIOverlay.jsx
 *
 * Purpose:  DOM layer that sits above the Pixi canvas.
 *           Contains all HTML/CSS UI: HUD, panels, tooltips, menus.
 *           Uses pointer-events-none on root so map clicks pass through,
 *           and pointer-events-auto only on interactive UI elements.
 *
 * Dependencies: React, Tailwind, useGameStore, useMapStore, MunicipalityPanel
 */

import useGameStore from '../../stores/useGameStore'
import useMapStore from '../../stores/useMapStore'
import MunicipalityPanel from './MunicipalityPanel'

export default function UIOverlay() {
  const { year, month, paused, togglePause } = useGameStore()
  const { labelsVisible, toggleLabels }       = useMapStore()

  // Format month number to abbreviated name for display
  const monthName = new Date(2000, month - 1).toLocaleString('default', { month: 'short' })

  return (
    // Full-screen overlay — pointer-events-none lets clicks reach Pixi beneath
    <div className="absolute inset-0 pointer-events-none">

      {/* ── Top HUD Bar ─────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-stone-950/80 border-b border-stone-700 pointer-events-auto">

        {/* Game title */}
        <span className="text-stone-400 text-sm font-mono tracking-widest uppercase">
          Kapuluan
        </span>

        {/* Current date display */}
        <span className="text-amber-300 text-sm font-mono">
          {monthName} {year} CE
        </span>

        {/* Right-side controls */}
        <div className="flex items-center gap-2">

          {/* Label visibility toggle */}
          <button
            onClick={toggleLabels}
            title="Toggle municipality labels"
            className={`text-xs px-3 py-1 rounded border transition-colors ${
              labelsVisible
                ? 'border-amber-600 text-amber-300 hover:bg-amber-900/40'
                : 'border-stone-600 text-stone-500 hover:bg-stone-700'
            }`}
          >
            Labels
          </button>

          {/* Pause/resume control */}
          <button
            onClick={togglePause}
            className="text-xs px-3 py-1 rounded border border-stone-600 text-stone-300 hover:bg-stone-700 transition-colors"
          >
            {paused ? 'Resume' : 'Pause'}
          </button>

        </div>

      </div>

      {/* ── Municipality Info Panel ──────────────────────────────── */}
      {/* Renders only when a municipality is selected; self-contained */}
      <MunicipalityPanel />

    </div>
  )
}
