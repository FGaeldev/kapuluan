/**
 * MainMenu.jsx
 *
 * Purpose:  Full-screen main menu rendered above the Pixi map during
 *           the 'menu' phase. Fades out when New Game is clicked,
 *           then transitions to 'setup' phase for municipality selection.
 *
 *           Load Game, Settings, and Credits are stubbed — they log to
 *           console and show a "coming soon" notice until implemented.
 *
 * Usage:    Rendered by App.jsx when phase === 'menu'.
 *
 * Dependencies: React, Tailwind, useGameStore
 */

import { useState } from 'react'
import useGameStore from '../../stores/useGameStore'

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * Primary menu button — full width, amber accent on hover.
 *
 * @param {{ label: string, onClick: Function, disabled?: boolean }} props
 */
function MenuButton({ label, onClick, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full text-left px-6 py-3 border transition-all duration-150 font-serif tracking-wide
        ${disabled
          ? 'border-stone-800 text-stone-700 cursor-not-allowed'
          : 'border-stone-700 text-stone-300 hover:border-amber-600 hover:text-amber-300 hover:bg-amber-950/20 cursor-pointer'
        }
      `}
    >
      {label}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MainMenu() {
  const setPhase = useGameStore((s) => s.setPhase)

  // Controls CSS fade-out before phase transition
  const [fading, setFading] = useState(false)

  // Stub notice shown for unimplemented buttons
  const [stub, setStub] = useState(null)

  /**
   * Begin New Game flow.
   * Fades the menu out over 400ms, then transitions to 'setup' phase.
   * The map is already loaded behind the menu — no load delay.
   */
  function handleNewGame() {
    setStub(null)
    setFading(true)
    setTimeout(() => setPhase('setup'), 400)
  }

  /**
   * Show a stub notice for unimplemented menu options.
   * @param {string} label - Feature name to display in notice
   */
  function handleStub(label) {
    setStub(`${label} — coming soon`)
  }

  return (
    <div
      className={`
        absolute inset-0 z-50 flex flex-col items-center justify-center
        bg-stone-950/92 backdrop-blur-sm
        transition-opacity duration-400
        ${fading ? 'opacity-0 pointer-events-none' : 'opacity-100'}
      `}
    >
      {/* ── Title block ─────────────────────────────────────────── */}
      <div className="mb-12 text-center">
        <h1 className="text-6xl font-serif text-amber-300 tracking-widest uppercase mb-3">
          Kapuluan
        </h1>
        <p className="text-stone-500 text-sm font-mono tracking-widest uppercase">
          A Philippine Grand Strategy
        </p>
      </div>

      {/* ── Menu buttons ────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 w-72">
        <MenuButton label="New Game"   onClick={handleNewGame} />
        <MenuButton label="Load Game"  onClick={() => handleStub('Load Game')} />
        <MenuButton label="Settings"   onClick={() => handleStub('Settings')} />
        <MenuButton label="Credits"    onClick={() => handleStub('Credits')} />
      </div>

      {/* ── Stub notice ─────────────────────────────────────────── */}
      {stub && (
        <p className="mt-6 text-stone-500 text-xs font-mono italic">
          {stub}
        </p>
      )}

      {/* ── Version watermark ───────────────────────────────────── */}
      <p className="absolute bottom-4 right-5 text-stone-700 text-xs font-mono">
        v0.1.0-dev
      </p>
    </div>
  )
}
