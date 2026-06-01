/**
 * useGameStore.js
 * 
 * Purpose: Root game state store. Holds global game metadata —
 *          current year, era, game speed, and pause state.
 * 
 * Usage:   Import and call useGameStore() in any React component.
 * 
 * Dependencies: zustand, immer (via zustand/middleware)
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

const useGameStore = create(
  immer((set) => ({
    // ── Game Clock ──────────────────────────────────────────────
    year: 900,          // Current in-game year (CE)
    month: 1,           // 1–12
    era: 'pre_colonial', // Active era string key

    // ── Playback ─────────────────────────────────────────────────
    paused: true,       // Game starts paused
    speed: 1,           // Tick multiplier (1 = normal, 3 = fast)

    // ── Actions ──────────────────────────────────────────────────

    /**
     * Advance game time by one month.
     * Rolls over month to next year when December passes.
     */
    tick: () => set((state) => {
      state.month += 1
      if (state.month > 12) {
        state.month = 1
        state.year += 1
      }
    }),

    /**
     * Toggle pause state.
     */
    togglePause: () => set((state) => {
      state.paused = !state.paused
    }),

    /**
     * Set game speed multiplier.
     * @param {number} value - Speed level (1, 2, or 3)
     */
    setSpeed: (value) => set((state) => {
      state.speed = value
    }),
  }))
)

export default useGameStore