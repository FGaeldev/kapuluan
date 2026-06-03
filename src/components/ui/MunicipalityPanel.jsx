/**
 * MunicipalityPanel.jsx
 *
 * Purpose:  Side panel that displays detailed information about the currently
 *           selected municipality. Shows geographic identity, placeholder game
 *           stats grouped by category, and a close button.
 *
 *           All numeric stats are placeholder values (Math.random seeded by
 *           feature index) until the game data layer is implemented.
 *
 * Usage:    Render inside UIOverlay. Reads selectedProvince from useMapStore.
 *           Visible only when a municipality is selected.
 *
 * Dependencies: React, Tailwind, useMapStore
 */

import useMapStore from '../../stores/useMapStore'
import useRulerStore, { RULER_COLORS } from '../../stores/useRulerStore'

// ── Placeholder stat generation ───────────────────────────────────────────────

/**
 * Simple seeded pseudo-random number generator (mulberry32).
 * Produces consistent placeholder values for the same municipality
 * across re-renders without storing anything in state.
 *
 * @param {number} seed - Integer seed
 * @returns {Function} () => number in [0, 1)
 */
function seededRng(seed) {
  let s = seed >>> 0
  return () => {
    s += 0x6D2B79F5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Generate all placeholder stats for a municipality.
 * Values are seeded by feature index so they're stable per municipality.
 *
 * @param {number} index - Feature index in geojson.features array
 * @returns {object} Map of stat key → display value
 */
function generatePlaceholderStats(index) {
  const rng = seededRng(index * 7919)   // Prime multiplier for distribution

  const pop          = Math.floor(rng() * 180000 + 5000)
  const workforce    = Math.floor(pop * (rng() * 0.3 + 0.4))
  const employed     = Math.floor(workforce * (rng() * 0.25 + 0.7))
  const gdp          = Math.floor(rng() * 4500000000 + 50000000)
  const loyalists    = Math.floor(rng() * 60 + 20)

  return {
    // ── Demographics ─────────────────────────────────────────────────────
    population:        pop.toLocaleString(),
    populationGrowth:  `${(rng() * 4 - 0.5).toFixed(2)}%`,
    workforce:         workforce.toLocaleString(),
    employmentRate:    `${((employed / workforce) * 100).toFixed(1)}%`,

    // ── Human Development ─────────────────────────────────────────────────
    literacy:          `${(rng() * 40 + 55).toFixed(1)}%`,
    standardOfLiving:  `${Math.floor(rng() * 60 + 20)}/100`,

    // ── Economy ──────────────────────────────────────────────────────────
    gdp:               `₱${(gdp / 1_000_000).toFixed(1)}M`,
    gdpPerCapita:      `₱${Math.floor(gdp / pop).toLocaleString()}`,
    taxRevenue:        `₱${(gdp * (rng() * 0.05 + 0.08) / 1_000_000).toFixed(2)}M/mo`,
    marketAccess:      `${Math.floor(rng() * 60 + 20)}/100`,
    mainIndustries:    pickIndustries(rng),

    // ── Infrastructure ────────────────────────────────────────────────────
    infrastructure:       `${Math.floor(rng() * 70 + 20)}/100`,
    infrastructureUsage:  `${(rng() * 50 + 40).toFixed(1)}%`,
    constructionCapacity: `${Math.floor(rng() * 8 + 1)} units/mo`,

    // ── Urbanization & Migration ──────────────────────────────────────────
    urbanization:       `${(rng() * 70 + 10).toFixed(1)}%`,
    migrationAttraction: migrationLabel(rng()),

    // ── Politics & Society ────────────────────────────────────────────────
    loyalists:  `${loyalists}%`,
    radicals:   `${Math.floor(rng() * 20)}%`,
    dominantCulture:  pickCulture(rng),
    dominantReligion: pickReligion(rng),

    // ── Land & Resources ──────────────────────────────────────────────────
    arableLand:      `${(rng() * 60 + 5).toFixed(1)}%`,
    resourceDeposits: pickResources(rng),

    // ── Stability & Prosperity ────────────────────────────────────────────
    municipalStability:  `${Math.floor(rng() * 60 + 30)}/100`,
    municipalProsperity: `${Math.floor(rng() * 60 + 20)}/100`,
  }
}

// ── Picker helpers ────────────────────────────────────────────────────────────

const INDUSTRIES = ['Agriculture', 'Fishing', 'Mining', 'Forestry', 'Manufacturing', 'Trade', 'Services', 'Tourism']
const CULTURES   = ['Ilocano', 'Kapampangan', 'Tagalog', 'Bicolano', 'Waray', 'Cebuano', 'Hiligaynon', 'Maranao', 'Tausug']
const RELIGIONS  = ['Roman Catholic', 'Islam', 'Aglipayan', 'Protestant', 'Indigenous Belief']
const RESOURCES  = ['Gold', 'Copper', 'Timber', 'Coal', 'Iron', 'Nickel', 'Fish', 'Guano', 'None']
const MIGRATION  = ['Strong Inflow', 'Moderate Inflow', 'Neutral', 'Moderate Outflow', 'Strong Outflow']

/** @param {Function} rng */
function pickIndustries(rng) {
  const count = Math.floor(rng() * 2) + 1
  const picked = []
  for (let i = 0; i < count; i++) {
    picked.push(INDUSTRIES[Math.floor(rng() * INDUSTRIES.length)])
  }
  return [...new Set(picked)].join(', ')
}
/** @param {Function} rng */
function pickCulture(rng)   { return CULTURES[Math.floor(rng() * CULTURES.length)] }
/** @param {Function} rng */
function pickReligion(rng)  { return RELIGIONS[Math.floor(rng() * RELIGIONS.length)] }
/** @param {Function} rng */
function pickResources(rng) { return RESOURCES[Math.floor(rng() * RESOURCES.length)] }
/** @param {number} v - raw rng value in [0,1) */
function migrationLabel(v)  { return MIGRATION[Math.floor(v * MIGRATION.length)] }

// ── Stat category definitions ─────────────────────────────────────────────────

/**
 * Ordered list of stat categories with their display labels and stat keys.
 * Keys must match those returned by generatePlaceholderStats().
 */
const CATEGORIES = [
  {
    label: 'Demographics',
    stats: [
      { key: 'population',       label: 'Population'        },
      { key: 'populationGrowth', label: 'Pop. Growth'       },
      { key: 'workforce',        label: 'Workforce'         },
      { key: 'employmentRate',   label: 'Employment Rate'   },
    ],
  },
  {
    label: 'Human Development',
    stats: [
      { key: 'literacy',         label: 'Literacy'          },
      { key: 'standardOfLiving', label: 'Std. of Living'    },
    ],
  },
  {
    label: 'Economy',
    stats: [
      { key: 'gdp',           label: 'GDP'            },
      { key: 'gdpPerCapita',  label: 'GDP per Capita' },
      { key: 'taxRevenue',    label: 'Tax Revenue'    },
      { key: 'marketAccess',  label: 'Market Access'  },
      { key: 'mainIndustries',label: 'Main Industries'},
    ],
  },
  {
    label: 'Infrastructure',
    stats: [
      { key: 'infrastructure',      label: 'Infrastructure'      },
      { key: 'infrastructureUsage', label: 'Infra. Usage'        },
      { key: 'constructionCapacity',label: 'Construction Cap.'   },
    ],
  },
  {
    label: 'Urbanization',
    stats: [
      { key: 'urbanization',       label: 'Urbanization'        },
      { key: 'migrationAttraction',label: 'Migration'           },
    ],
  },
  {
    label: 'Politics & Society',
    stats: [
      { key: 'loyalists',       label: 'Loyalists'        },
      { key: 'radicals',        label: 'Radicals'         },
      { key: 'dominantCulture', label: 'Dom. Culture'     },
      { key: 'dominantReligion',label: 'Dom. Religion'    },
    ],
  },
  {
    label: 'Land & Resources',
    stats: [
      { key: 'arableLand',      label: 'Arable Land'      },
      { key: 'resourceDeposits',label: 'Resources'        },
    ],
  },
  {
    label: 'Stability & Prosperity',
    stats: [
      { key: 'municipalStability',  label: 'Stability'   },
      { key: 'municipalProsperity', label: 'Prosperity'  },
    ],
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * Single stat row — label on left, value on right.
 *
 * @param {{ label: string, value: string }} props
 */
function StatRow({ label, value }) {
  return (
    <div className="flex justify-between items-baseline gap-2 py-0.5">
      <span className="text-stone-400 text-xs shrink-0">{label}</span>
      <span className="text-stone-200 text-xs text-right">{value}</span>
    </div>
  )
}

/**
 * Grouped category block with a header and its stat rows.
 *
 * @param {{ label: string, stats: Array, values: object }} props
 */
function StatCategory({ label, stats, values }) {
  return (
    <div className="mb-3">
      <p className="text-amber-500 text-xs font-semibold uppercase tracking-wider mb-1">
        {label}
      </p>
      {stats.map(({ key, label: statLabel }) => (
        <StatRow key={key} label={statLabel} value={values[key] ?? '—'} />
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MunicipalityPanel() {
  const selectedProvince    = useMapStore((s) => s.selectedProvince)
  const setSelectedProvince = useMapStore((s) => s.setSelectedProvince)
  const geojson             = useMapStore((s) => s.geojson)
  const rulerOf             = useRulerStore((s) => s.rulerOf)
  const rulers              = useRulerStore((s) => s.rulers)

  // Panel is hidden when nothing is selected
  if (!selectedProvince) return null

  // Derive feature index from GID_2 for stable seeded placeholder stats.
  const featureIndex = geojson
    ? geojson.features.findIndex(
        (f) => f.properties.GID_2 === selectedProvince.GID_2
      )
    : 0

  const stats = generatePlaceholderStats(featureIndex)

  // Ruler lookup for this municipality
  const rulerId = rulerOf[selectedProvince.GID_2] ?? null
  const ruler   = rulerId !== null ? rulers.find((r) => r.id === rulerId) : null

  // Convert Pixi hex int to CSS hex string for inline styling
  const rulerCssColor = ruler
    ? '#' + RULER_COLORS[ruler.id % RULER_COLORS.length].toString(16).padStart(6, '0')
    : null

  return (
    // Panel sits in bottom-right; pointer-events-auto so it's interactive
    <div className="absolute bottom-4 right-4 w-72 max-h-[80vh] flex flex-col pointer-events-auto">
      <div className="bg-stone-950/95 border border-stone-700 rounded-lg flex flex-col overflow-hidden shadow-2xl">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-4 pt-4 pb-2 border-b border-stone-700 shrink-0">
          <div>
            {/* Municipality name */}
            <h2 className="text-amber-300 font-serif text-base leading-tight">
              {selectedProvince.NAME_2}
            </h2>
            {/* Province */}
            <p className="text-stone-400 text-xs mt-0.5">
              {selectedProvince.NAME_1} Province
            </p>
            {/* Geo identifiers */}
            <p className="text-stone-600 text-xs mt-1 font-mono">
              {selectedProvince.HASC_2} · {selectedProvince.TYPE_2?.split('|')[0]}
            </p>
            {/* Region */}
            <p className="text-stone-500 text-xs mt-0.5">
              {selectedProvince.REGION}
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={() => setSelectedProvince(null)}
            className="text-stone-500 hover:text-stone-200 transition-colors ml-2 mt-0.5 text-lg leading-none"
            title="Close panel"
          >
            ×
          </button>
        </div>

        {/* ── Ruler banner ─────────────────────────────────────────── */}
        <div className="px-4 py-2 border-b border-stone-800 shrink-0 flex items-center gap-2">
          {ruler ? (
            <>
              {/* Color swatch matching map fill */}
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: rulerCssColor }}
              />
              <span className="text-stone-300 text-xs">
                {ruler.isPlayer ? 'Your Territory' : `Controlled by ${ruler.name}`}
              </span>
            </>
          ) : (
            <span className="text-stone-500 text-xs italic">Uncontrolled Territory</span>
          )}
        </div>

        {/* ── Placeholder data notice ──────────────────────────────── */}
        <div className="px-4 py-1.5 bg-stone-900/60 border-b border-stone-800 shrink-0">
          <p className="text-stone-500 text-xs italic">
            Placeholder stats — game data layer pending
          </p>
        </div>

        {/* ── Scrollable stats body ────────────────────────────────── */}
        <div className="overflow-y-auto px-4 py-3 flex-1 scrollbar-thin scrollbar-thumb-stone-700">
          {CATEGORIES.map((cat) => (
            <StatCategory
              key={cat.label}
              label={cat.label}
              stats={cat.stats}
              values={stats}
            />
          ))}
        </div>

      </div>
    </div>
  )
}
