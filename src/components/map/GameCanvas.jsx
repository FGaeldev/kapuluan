/**
 * GameCanvas.jsx
 *
 * Purpose:  Mounts the Pixi.js v7 Stage and bridges native DOM input events
 *           (pointer and wheel) to MapStage via shared refs.
 *           All pan/zoom input is handled via native DOM — Pixi's own event
 *           system is bypassed for reliability.
 *
 * Dependencies: @pixi/react v7, pixi.js v7, React
 */

import { Stage } from '@pixi/react'
import { useState, useEffect, useRef } from 'react'
import MapStage from './MapStage'

export default function GameCanvas() {
  // Track viewport dimensions for responsive canvas sizing
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  })

  // Refs to forward native DOM events into MapStage handlers
  const wheelHandlerRef   = useRef(null)
  const pointerDownRef    = useRef(null)
  const pointerMoveRef    = useRef(null)
  const pointerUpRef      = useRef(null)

  // ── Resize listener ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ── Native wheel listener (zoom) ────────────────────────────────────────
  useEffect(() => {
    const handleWheel = (e) => {
      e.preventDefault()
      if (wheelHandlerRef.current) wheelHandlerRef.current(e)
    }
    // passive: false required to call preventDefault
    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [])

  // ── Native pointer listeners (pan) ──────────────────────────────────────
  useEffect(() => {
    const onDown = (e) => { if (pointerDownRef.current) pointerDownRef.current(e) }
    const onMove = (e) => { if (pointerMoveRef.current) pointerMoveRef.current(e) }
    const onUp   = (e) => { if (pointerUpRef.current)   pointerUpRef.current(e) }

    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup',   onUp)

    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
    }
  }, [])

  return (
    <Stage
      width={dimensions.width}
      height={dimensions.height}
      options={{
        backgroundAlpha: 0,   // Transparent — CSS controls background color
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      }}
    >
      <MapStage
        width={dimensions.width}
        height={dimensions.height}
        wheelHandlerRef={wheelHandlerRef}
        pointerDownRef={pointerDownRef}
        pointerMoveRef={pointerMoveRef}
        pointerUpRef={pointerUpRef}
      />
    </Stage>
  )
}
