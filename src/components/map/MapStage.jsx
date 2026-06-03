/**
 * MapStage.jsx
 *
 * Purpose:  Renders all Philippine municipality polygons and name labels
 *           inside a pannable, zoomable Pixi Container. Handles hover
 *           highlight and click selection per municipality.
 *
 * Pan:      Native DOM pointerdown/move/up forwarded via refs from GameCanvas.
 * Zoom:     Native DOM wheel event forwarded via ref from GameCanvas.
 * Hover:    R-tree spatial index (rbush) narrows candidates, then ray-casting
 *           confirms exact hit. Handles ~1,600 features without lag.
 * Select:   Fires on pointerup if pointer did not drag.
 * Labels:   Municipality names (NAME_2) rendered as Pixi Text at centroid,
 *           visible only above LABEL_MIN_SCALE to avoid clutter.
 *
 * Projection: Equirectangular — maps lon/lat linearly to canvas pixels.
 *             Sufficient for Philippines (narrow lat range, no polar distortion).
 *
 * Dependencies: @pixi/react v7, pixi.js v7, rbush, React, useMapStore
 */

import { Container, Graphics, Text } from '@pixi/react'
import * as PIXI from 'pixi.js'
import RBush from 'rbush'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useMapStore from '../../stores/useMapStore'
import useRulerStore, { RULER_COLORS } from '../../stores/useRulerStore'

// ── Color constants ───────────────────────────────────────────────────────────
const COLOR_DEFAULT  = 0x2D5A3D   // Uncontrolled municipality — dark forest green
const COLOR_HOVER    = 0x4A8C5C   // Hovered municipality — lighter green
const COLOR_SELECTED = 0xC4923A   // Selected municipality — amber/gold
const COLOR_BORDER   = 0x8B7355   // Municipality borders — parchment brown
const COLOR_SEA      = 0x1A2E3A   // Sea/background — deep navy
const COLOR_DIMMED   = 0x111A14   // Out-of-region fog-of-war overlay color
const FOG_ALPHA      = 0.72       // Opacity of fog overlay on out-of-region tiles

// ── Zoom limits ───────────────────────────────────────────────────────────────
const MIN_SCALE      = 1
const MAX_SCALE      = 48.0
const ZOOM_STEP      = 0.2        // Scale multiplier per scroll tick

// ── Label visibility threshold ────────────────────────────────────────────────
// At 1,600+ municipalities, labels are unreadable below this zoom level.
// Tune upward if labels still overlap at this threshold.
const LABEL_MIN_SCALE = 3.0

// ── Border thickness ──────────────────────────────────────────────────────────
// Screen-space border width in pixels. Divided by viewport.scale in draw()
// so borders appear this thick regardless of zoom level.
// Increase to make municipality boundaries more prominent when zoomed in.
const BASE_BORDER = 0.8

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
 * to canvas pixel coordinates. Adds padding so polygons don't touch edges.
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
 * Only called on candidates pre-filtered by the R-tree — not on all features.
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

/**
 * Build an R-tree spatial index over all municipality bounding boxes.
 *
 * Each entry stores the projected (canvas-space) bounding box of one feature,
 * plus its original feature index so we can look it up after a query.
 *
 * R-tree query for a point returns only features whose bounding box overlaps
 * that point — typically 1–5 candidates out of 1,600. Ray-casting then runs
 * only on those candidates, making hover hit-testing fast even on low-end hardware.
 *
 * @param {Array}    features - GeoJSON Feature array
 * @param {Function} project  - Projection function (lon, lat) => [x, y]
 * @returns {RBush} Populated spatial index
 */
function buildSpatialIndex(features, project) {
  const tree  = new RBush()
  const items = []

  features.forEach((feature, index) => {
    const geom     = feature.geometry
    const polygons = geom.type === 'MultiPolygon'
      ? geom.coordinates
      : [geom.coordinates]

    // Compute projected bounding box across all rings in this feature
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    polygons.forEach((polygon) => {
      polygon.forEach((ring) => {
        ring.forEach(([lon, lat]) => {
          const [x, y] = project(lon, lat)
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        })
      })
    })

    // rbush expects { minX, minY, maxX, maxY } plus any extra fields
    items.push({ minX, minY, maxX, maxY, featureIndex: index })
  })

  tree.load(items)   // Bulk load is faster than inserting one at a time
  return tree
}

/**
 * Compute the visual centroid of a GeoJSON feature by averaging all
 * coordinate points on the outer ring of the largest polygon.
 *
 * Using the largest polygon avoids placing the label on a tiny island
 * for multi-part municipalities (e.g. coastal barangays with islets).
 *
 * @param {object}   feature - GeoJSON Feature (Polygon or MultiPolygon)
 * @param {Function} project - Projection function (lon, lat) => [x, y]
 * @returns {{ x: number, y: number }} Projected centroid in canvas space
 */
function computeCentroid(feature, project) {
  const geom     = feature.geometry
  const polygons = geom.type === 'MultiPolygon'
    ? geom.coordinates
    : [geom.coordinates]

  // Pick largest polygon by outer ring point count — best proxy for area
  const largest = polygons.reduce((best, poly) =>
    poly[0].length > best[0].length ? poly : best
  )

  const ring = largest[0]   // Outer ring only — ignore holes
  let sumX = 0
  let sumY = 0

  ring.forEach(([lon, lat]) => {
    const [x, y] = project(lon, lat)
    sumX += x
    sumY += y
  })

  return { x: sumX / ring.length, y: sumY / ring.length }
}

// ── Shared PIXI.TextStyle ─────────────────────────────────────────────────────
// Defined outside component to avoid recreating the object on every render.
// Stroke gives readability on both green fills and amber selected fill.
const LABEL_STYLE = new PIXI.TextStyle({
  fontFamily: 'Georgia, serif',
  fontSize: 8,
  fill: '#FFFFFF',
  stroke: '#000000',
  strokeThickness: 2,
  align: 'center',
  letterSpacing: 0.3,
})

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
  const labelsVisible        = useMapStore((s) => s.labelsVisible)
  const playerMunicipality   = useMapStore((s) => s.playerMunicipality)

  // Ruler store — ruler color lookup and player region for fog of war
  const rulerOf  = useRulerStore((s) => s.rulerOf)
  const rulers   = useRulerStore((s) => s.rulers)

  // Derive player's region from their starting municipality — used for fog of war.
  // Municipalities outside this region are darkened.
  const playerRegion = playerMunicipality?.REGION ?? null

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
  const viewportRef = useRef(viewport)
  useEffect(() => { viewportRef.current = viewport }, [viewport])

  // ── Hover index ref — same reason as viewportRef ──────────────────────────
  const hoveredIndexRef = useRef(hoveredIndex)
  useEffect(() => { hoveredIndexRef.current = hoveredIndex }, [hoveredIndex])

  // ── Cursor position in local canvas space ────────────────────────────────
  // Stored as both a ref (always current, for event handlers) and state
  // (triggers label re-filter on move). State updates are throttled via
  // requestAnimationFrame to avoid re-rendering every pointermove event.
  const cursorLocalRef   = useRef({ x: 0, y: 0 })
  const [cursorLocal, setCursorLocal] = useState({ x: 0, y: 0 })
  const rafPendingRef    = useRef(false)   // RAF gate — prevents queuing multiple frames

  // ── Projection + spatial index cache ─────────────────────────────────────
  // Both recomputed only when geojson or canvas size changes.
  // spatialIndexRef holds the R-tree; projectionRef holds the project fn.
  const projectionRef    = useRef(null)
  const spatialIndexRef  = useRef(null)

  useEffect(() => {
    if (!geojson) return

    const bounds  = computeBounds(geojson.features)
    const project = buildProjection(bounds, width, height)

    projectionRef.current   = { bounds, project }
    spatialIndexRef.current = buildSpatialIndex(geojson.features, project)

    console.info(`[Kapuluan] Spatial index built for ${geojson.features.length} features.`)
  }, [geojson, width, height])

  // ── Label data — centroids + NAME_2, computed once per geojson load ───────
  const labelData = useMemo(() => {
    if (!geojson || !projectionRef.current) return []
    const { project } = projectionRef.current

    return geojson.features.map((feature, i) => ({
      ...computeCentroid(feature, project),
      name: feature.properties.NAME_2 ?? '',
      id: i,   // Stable key — survives proximity filtering re-order
    }))
  // projectionRef is a ref — depend on geojson + canvas size instead
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const gid2       = feature.properties.GID_2
      const region     = feature.properties.REGION

      // Fog of war — municipalities outside the player's region are darkened.
      // Only applies once a player region is known (after setup phase).
      const isInPlayerRegion = !playerRegion || region === playerRegion
      const isDimmed = !isInPlayerRegion

      // Ruler color — gold for player, bot colors for bots, default for uncontrolled
      const rulerId   = rulerOf[gid2] ?? null
      const rulerColor = rulerId !== null ? RULER_COLORS[rulerId % RULER_COLORS.length] : COLOR_DEFAULT

      const fillColor = isDimmed
        ? COLOR_DIMMED                    // Fog of war overrides everything
        : isSelected
          ? COLOR_SELECTED
          : isHovered
            ? COLOR_HOVER
            : rulerColor                  // Ruler color or uncontrolled default

      const fillAlpha = isDimmed ? 0.95 : 0.85

      const geom     = feature.geometry
      const polygons = geom.type === 'MultiPolygon'
        ? geom.coordinates
        : [geom.coordinates]

      // Dimmed borders are nearly invisible — only in-region borders are drawn clearly
      const borderAlpha = isDimmed ? 0.15 : 0.9
      g.lineStyle(BASE_BORDER / viewport.scale, COLOR_BORDER, borderAlpha)
      g.beginFill(fillColor, fillAlpha)

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
  }, [geojson, width, height, hoveredIndex, selectedIndex, viewport.scale])

  // ── Determine if labels should be visible ────────────────────────────────
  // Both conditions must be true: user toggle ON and zoom above threshold.
  const showLabels = labelsVisible && viewport.scale >= LABEL_MIN_SCALE

  // ── Proximity-filtered label list ─────────────────────────────────────────
  // Only render labels whose centroid falls within LABEL_RADIUS canvas units
  // of the cursor. LABEL_RADIUS is expressed in canvas (local) space and
  // scaled inversely with zoom so the visible screen-space radius stays
  // constant at ~200px regardless of zoom level.
  //
  // This drops rendered Text nodes from ~1,600 to typically 3–10,
  // eliminating the main source of Pixi scene-graph overhead at high zoom.
  const LABEL_RADIUS_SCREEN = 100   // Target screen-space radius in pixels
  const labelRadius = LABEL_RADIUS_SCREEN / viewport.scale   // Canvas-space radius
  const labelRadiusSq = labelRadius * labelRadius             // Avoid sqrt per label

  const visibleLabels = showLabels
    ? labelData.filter((label) => {
        const dx = label.x - cursorLocal.x
        const dy = label.y - cursorLocal.y
        return (dx * dx + dy * dy) <= labelRadiusSq
      })
    : []



  // ── Input handlers ────────────────────────────────────────────────────────

  /**
   * Begin pan drag.
   * @param {PointerEvent} e
   */
  const handlePointerDown = useCallback((e) => {
    isDragging.current    = true
    didDrag.current       = false
    dragStart.current     = { x: e.clientX, y: e.clientY }
    viewportStart.current = { x: viewportRef.current.x, y: viewportRef.current.y }
  }, [])

  /**
   * Handle pointer move — pan if dragging, else R-tree hover hit-test.
   *
   * Hover pipeline:
   *   1. Convert screen coords to local container space (undo pan + zoom)
   *   2. Query R-tree with a point bbox — returns bbox-overlapping candidates only
   *   3. Ray-cast only those candidates to find exact polygon hit
   *
   * @param {PointerEvent} e
   */
  const handlePointerMove = useCallback((e) => {
    if (isDragging.current) {
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true

      setViewport((v) => ({
        ...v,
        x: viewportStart.current.x + dx,
        y: viewportStart.current.y + dy,
      }))
      return
    }

    if (!geojson || !projectionRef.current || !spatialIndexRef.current) return

    const v = viewportRef.current

    // Convert screen coords → local canvas space (undo viewport transform)
    const localX = (e.clientX - v.x) / v.scale
    const localY = (e.clientY - v.y) / v.scale

    const { project } = projectionRef.current

    // Update cursor position ref immediately (always current for label filtering)
    cursorLocalRef.current = { x: localX, y: localY }

    // Flush cursor to state via RAF — batches rapid pointermove events into
    // one React render per animation frame instead of one per event (~60fps max)
    if (!rafPendingRef.current) {
      rafPendingRef.current = true
      requestAnimationFrame(() => {
        setCursorLocal({ ...cursorLocalRef.current })
        rafPendingRef.current = false
      })
    }

    // R-tree point query — returns only features whose bbox contains this point.
    // A point bbox has minX===maxX and minY===maxY.
    const candidates = spatialIndexRef.current.search({
      minX: localX, minY: localY,
      maxX: localX, maxY: localY,
    })

    // Ray-cast only bbox candidates — typically 1–5 features instead of 1,600
    let hit = -1
    for (const candidate of candidates) {
      const feature  = geojson.features[candidate.featureIndex]
      const geom     = feature.geometry
      const polygons = geom.type === 'MultiPolygon'
        ? geom.coordinates
        : [geom.coordinates]

      const inside = polygons.some((polygon) =>
        polygon.some((ring) => pointInRing(localX, localY, ring, project))
      )

      if (inside) {
        hit = candidate.featureIndex
        break
      }
    }

    setHoveredIndex(hit >= 0 ? hit : null)
  }, [geojson])

  /**
   * End drag. If no drag occurred, treat as municipality click/select.
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

      {/* Pannable / zoomable container — municipality graphics and labels */}
      <Container
        x={viewport.x}
        y={viewport.y}
        scale={viewport.scale}
      >
        {/* Municipality polygon fills and borders */}
        <Graphics draw={draw} />

        {/*
          Municipality name labels (NAME_2).
          Hidden below LABEL_MIN_SCALE — too many to read at low zoom.
          anchor={[0.5, 0.5]} centers label on computed centroid.
          scale={1 / viewport.scale} keeps text a consistent screen size
          regardless of zoom level — prevents text from growing with the map.
        */}
        {showLabels && visibleLabels.map((label) => (
          <Text
            key={label.id}
            text={label.name}
            x={label.x}
            y={label.y}
            anchor={[0.5, 0.5]}
            style={LABEL_STYLE}
            scale={1 / viewport.scale}
          />
        ))}
      </Container>
    </>
  )
}
