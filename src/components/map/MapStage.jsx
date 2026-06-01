/**
 * MapStage.jsx
 *
 * Purpose:  Renders all Philippine province polygons inside a pannable,
 *           zoomable Pixi Container. Handles hover highlight and click
 *           selection per province.
 *
 * Pan:      Native DOM pointerdown/move/up forwarded via refs from GameCanvas.
 * Zoom:     Native DOM wheel event forwarded via ref from GameCanvas.
 * Hover:    Hit-tested on pointermove using ray-casting against projected rings.
 * Select:   Fires on pointerup if pointer did not drag.
 *
 * Projection: Equirectangular — maps lon/lat linearly to canvas pixels.
 *             Sufficient for Philippines (narrow lat range, no polar distortion).
 *
 * Dependencies: @pixi/react v7, pixi.js v7, React, useMapStore
 */

import { Container, Graphics } from '@pixi/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import useMapStore from '../../stores/useMapStore'

// ── Color constants ───────────────────────────────────────────────────────────
const COLOR_DEFAULT  = 0x2D5A3D   // Default province fill — dark forest green
const COLOR_HOVER    = 0x4A8C5C   // Hovered province — lighter green
const COLOR_SELECTED = 0xC4923A   // Selected province — amber/gold
const COLOR_BORDER   = 0x8B7355   // Province borders — parchment brown
const COLOR_SEA      = 0x1A2E3A   // Sea/background — deep navy

// ── Zoom limits ───────────────────────────────────────────────────────────────
const MIN_SCALE = 0.5
const MAX_SCALE = 8.0
const ZOOM_STEP = 0.1   // Scale multiplier per scroll tick

// ── Pure utility functions ────────────────────────────────────────────────────

/**
 * Compute bounding box across all GeoJSON features.
 *
 * @param {Array} features - GeoJSON Feature array
 * @returns {{ minLon, maxLon, minLat, maxLat }}
 */
function computeBounds(features) {
  let minLon = Infinity, maxLon = -Infinity
  let minLat = Infinity, maxLat = -Infinity

  features.forEach((feature) => {
    const geom = feature.geometry
    const rings = geom.type === 'MultiPolygon'
      ? geom.coordinates.flat(1)
      : geom.coordinates

    rings.forEach((ring) => {
      ring.forEach(([lon, lat]) => {
        if (lon < minLon) minLon = lon
        if (lon > maxLon) maxLon = lon
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      })
    })
  })

  return { minLon, maxLon, minLat, maxLat }
}

/**
 * Build an equirectangular projection function from geographic bounds
 * to canvas pixel coordinates. Adds padding so provinces don't touch edges.
 * Latitude axis is flipped (higher lat = lower y on screen).
 *
 * @param {{ minLon, maxLon, minLat, maxLat }} bounds
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @param {number} [padding=40] - Pixel padding from canvas edge
 * @returns {Function} project(lon, lat) => [x, y]
 */
function buildProjection(bounds, canvasWidth, canvasHeight, padding = 40) {
  const { minLon, maxLon, minLat, maxLat } = bounds
  const lonRange = maxLon - minLon
  const latRange = maxLat - minLat
  const drawW    = canvasWidth  - padding * 2
  const drawH    = canvasHeight - padding * 2

  // Uniform scale — preserves aspect ratio
  const scale    = Math.min(drawW / lonRange, drawH / latRange)

  // Center map within available draw area
  const offsetX  = padding + (drawW - lonRange * scale) / 2
  const offsetY  = padding + (drawH - latRange * scale) / 2

  return (lon, lat) => [
    offsetX + (lon - minLon) * scale,
    offsetY + (maxLat - lat) * scale,   // Flip Y: north = top
  ]
}

/**
 * Ray-casting point-in-polygon test.
 * Determines if screen point (px, py) falls inside a projected coordinate ring.
 *
 * @param {number}   px      - X coordinate in local container space
 * @param {number}   py      - Y coordinate in local container space
 * @param {Array}    ring    - GeoJSON coordinate ring [[lon, lat], ...]
 * @param {Function} project - Projection function (lon, lat) => [x, y]
 * @returns {boolean}
 */
function pointInRing(px, py, ring, project) {
  let inside = false
  const projected = ring.map(([lon, lat]) => project(lon, lat))

  for (let i = 0, j = projected.length - 1; i < projected.length; j = i++) {
    const [xi, yi] = projected[i]
    const [xj, yj] = projected[j]

    // Standard ray-casting crossing test
    const intersects = ((yi > py) !== (yj > py))
      && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)

    if (intersects) inside = !inside
  }

  return inside
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MapStage({
  width,
  height,
  wheelHandlerRef,
  pointerDownRef,
  pointerMoveRef,
  pointerUpRef,
}) {
  const geojson             = useMapStore((s) => s.geojson)
  const setSelectedProvince = useMapStore((s) => s.setSelectedProvince)

  // ── Hover / selection UI state ────────────────────────────────────────────
  const [hoveredIndex,  setHoveredIndex]  = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(null)

  // ── Viewport transform state (pan + zoom) ─────────────────────────────────
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 })

  // ── Drag tracking refs ────────────────────────────────────────────────────
  const isDragging    = useRef(false)
  const didDrag       = useRef(false)
  const dragStart     = useRef({ x: 0, y: 0 })
  const viewportStart = useRef({ x: 0, y: 0 })

  // ── Viewport ref — avoids stale closures in event handlers ───────────────
  // Handlers registered via refs can't see updated state via closure,
  // so we mirror viewport into a ref that's always current.
  const viewportRef = useRef(viewport)
  useEffect(() => { viewportRef.current = viewport }, [viewport])

  // ── Hover index ref — same reason as viewportRef ──────────────────────────
  const hoveredIndexRef = useRef(hoveredIndex)
  useEffect(() => { hoveredIndexRef.current = hoveredIndex }, [hoveredIndex])

  // ── Projection cache — recomputed only when geojson or canvas size changes ─
  const projectionRef = useRef(null)
  useEffect(() => {
    if (!geojson) return
    const bounds  = computeBounds(geojson.features)
    const project = buildProjection(bounds, width, height)
    projectionRef.current = { bounds, project }
  }, [geojson, width, height])

  // ── Province draw function ────────────────────────────────────────────────
  const draw = useCallback((g) => {
    g.clear()

    // Sea base — large enough to cover after pan/zoom
    g.beginFill(COLOR_SEA, 1)
    g.drawRect(-width * 10, -height * 10, width * 20, height * 20)
    g.endFill()

    if (!geojson || !projectionRef.current) return

    const { project } = projectionRef.current

    geojson.features.forEach((feature, index) => {
      const isHovered  = index === hoveredIndex
      const isSelected = index === selectedIndex
      const fillColor  = isSelected
        ? COLOR_SELECTED
        : isHovered
          ? COLOR_HOVER
          : COLOR_DEFAULT

      const geom     = feature.geometry
      const polygons = geom.type === 'MultiPolygon'
        ? geom.coordinates
        : [geom.coordinates]

      g.lineStyle(0.5, COLOR_BORDER, 0.9)
      g.beginFill(fillColor, 0.85)

      polygons.forEach((polygon) => {
        polygon.forEach((ring) => {
          const [startX, startY] = project(ring[0][0], ring[0][1])
          g.moveTo(startX, startY)

          for (let i = 1; i < ring.length; i++) {
            const [x, y] = project(ring[i][0], ring[i][1])
            g.lineTo(x, y)
          }

          g.closePath()
        })
      })

      g.endFill()
    })
  }, [geojson, width, height, hoveredIndex, selectedIndex])

  // ── Input handlers (use clientX/Y — native DOM events) ───────────────────

  /**
   * Begin pan drag. Record pointer and viewport start positions.
   * @param {PointerEvent} e
   */
  const handlePointerDown = useCallback((e) => {
    isDragging.current    = true
    didDrag.current       = false
    dragStart.current     = { x: e.clientX, y: e.clientY }
    viewportStart.current = { x: viewportRef.current.x, y: viewportRef.current.y }
  }, [])

  /**
   * Handle pointer move.
   * If dragging — pan the viewport.
   * If not dragging — hit-test provinces for hover highlight.
   *
   * @param {PointerEvent} e
   */
  const handlePointerMove = useCallback((e) => {
    if (isDragging.current) {
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y

      // Threshold prevents accidental drag on click
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true

      setViewport((v) => ({
        ...v,
        x: viewportStart.current.x + dx,
        y: viewportStart.current.y + dy,
      }))
      return
    }

    // ── Hover hit test ────────────────────────────────────────────────────
    if (!geojson || !projectionRef.current) return

    const v = viewportRef.current

    // Convert screen coordinates to local container space
    // Must undo the container's pan (x, y) and zoom (scale)
    const localX = (e.clientX - v.x) / v.scale
    const localY = (e.clientY - v.y) / v.scale

    const { project } = projectionRef.current

    const hit = geojson.features.findIndex((feature) => {
      const geom     = feature.geometry
      const polygons = geom.type === 'MultiPolygon'
        ? geom.coordinates
        : [geom.coordinates]

      return polygons.some((polygon) =>
        polygon.some((ring) => pointInRing(localX, localY, ring, project))
      )
    })

    setHoveredIndex(hit >= 0 ? hit : null)
  }, [geojson])

  /**
   * End drag. If pointer did not move, treat as province click.
   */
  const handlePointerUp = useCallback(() => {
    isDragging.current = false

    const hovered = hoveredIndexRef.current
    if (!didDrag.current && hovered !== null && geojson) {
      setSelectedIndex(hovered)
      setSelectedProvince(geojson.features[hovered].properties)
    }
  }, [geojson, setSelectedProvince])

  /**
   * Scroll wheel zoom — point under cursor stays fixed.
   * Formula: newOffset = cursor - (cursor - oldOffset) * (newScale / oldScale)
   *
   * @param {WheelEvent} e
   */
  const handleWheel = useCallback((e) => {
    const zoomIn  = e.deltaY < 0
    const factor  = zoomIn ? 1 + ZOOM_STEP : 1 - ZOOM_STEP
    const cursorX = e.clientX
    const cursorY = e.clientY

    setViewport((v) => {
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor))
      const newX     = cursorX - (cursorX - v.x) * (newScale / v.scale)
      const newY     = cursorY - (cursorY - v.y) * (newScale / v.scale)
      return { x: newX, y: newY, scale: newScale }
    })
  }, [])

  // ── Register all handlers into refs (forwarded from GameCanvas) ───────────
  useEffect(() => {
    if (pointerDownRef)  pointerDownRef.current  = handlePointerDown
    if (pointerMoveRef)  pointerMoveRef.current  = handlePointerMove
    if (pointerUpRef)    pointerUpRef.current    = handlePointerUp
    if (wheelHandlerRef) wheelHandlerRef.current = handleWheel
  }, [handlePointerDown, handlePointerMove, handlePointerUp, handleWheel])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Sea background — fills canvas behind the pannable container */}
      <Graphics
        draw={(g) => {
          g.clear()
          g.beginFill(COLOR_SEA, 1)
          g.drawRect(0, 0, width, height)
          g.endFill()
        }}
      />

      {/* Pannable / zoomable container — all province graphics live here */}
      <Container
        x={viewport.x}
        y={viewport.y}
        scale={viewport.scale}
      >
        <Graphics draw={draw} />
      </Container>
    </>
  )
}
