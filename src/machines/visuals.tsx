/** Small inline visuals shown inside the inspector. They read colours from CSS tokens. */

export function Bars({ items, max, highlight }: { items: [string, number][]; max?: number; highlight?: string }) {
  const top = max ?? Math.max(...items.map(([, v]) => Math.abs(v)), 1e-9)
  return (
    <div className="v-bars">
      {items.map(([label, v], i) => (
        <div key={i} className={`v-bar ${label === highlight ? 'is-hl' : ''}`}>
          <span className="v-bar-label">{label}</span>
          <span className="v-bar-track">
            <span className="v-bar-fill" style={{ width: `${(Math.abs(v) / top) * 100}%` }} />
          </span>
          <span className="v-bar-val">{v < 1 && v > -1 ? v.toFixed(2) : Math.round(v)}</span>
        </div>
      ))}
    </div>
  )
}

/** Heatmap; values expected in 0..1. */
export function Heat({ rows, cols, values }: { rows: string[]; cols: string[]; values: number[][] }) {
  return (
    <div className="v-heat" style={{ gridTemplateColumns: `auto repeat(${cols.length}, 1fr)` }}>
      <span />
      {cols.map((c, i) => (
        <span key={i} className="v-heat-col">{c}</span>
      ))}
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <span className="v-heat-row">{r}</span>
          {values[i].map((v, j) => (
            <span key={j} className="v-heat-cell" style={{ ['--a' as string]: v }} title={v.toFixed(2)}>
              {v >= 0.995 ? '1' : v.toFixed(2).replace(/^0/, '')}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Grid of cells; each value is a class name suffix or a number 0..1 for intensity. */
export function Cells({ grid, size = 14 }: { grid: (string | number)[][]; size?: number }) {
  return (
    <div className="v-cells" style={{ gridTemplateColumns: `repeat(${grid[0].length}, ${size}px)` }}>
      {grid.flatMap((row, r) =>
        row.map((v, c) =>
          typeof v === 'number' ? (
            <span key={`${r}-${c}`} className="v-cell num" style={{ ['--a' as string]: v, width: size, height: size }} />
          ) : (
            <span key={`${r}-${c}`} className={`v-cell c-${v}`} style={{ width: size, height: size }} />
          ),
        ),
      )}
    </div>
  )
}

export function Dots({
  points,
  query,
  radius,
}: {
  points: { x: number; y: number; cls: string; near?: boolean }[]
  query?: { x: number; y: number }
  radius?: number
}) {
  const s = (v: number) => 8 + v * 16.4
  const t = (v: number) => 172 - v * 16.4
  return (
    <svg viewBox="0 0 180 180" className="v-dots">
      <rect x="4" y="4" width="172" height="172" rx="8" className="v-dots-bg" />
      {query && radius !== undefined && <circle cx={s(query.x)} cy={t(query.y)} r={radius * 16.4 + 5} className="v-dots-r" />}
      {points.map((p, i) => (
        <circle key={i} cx={s(p.x)} cy={t(p.y)} r={p.near ? 5 : 3.5} className={`v-dot ${p.cls} ${p.near ? 'near' : ''}`} />
      ))}
      {query && <rect x={s(query.x) - 6} y={t(query.y) - 6} width="12" height="12" rx="3" className="v-dots-q" />}
    </svg>
  )
}

export function Vector({ values, label }: { values: number[]; label?: string }) {
  return (
    <div className="v-vec">
      {label && <span className="v-vec-label">{label}</span>}
      {values.map((v, i) => (
        <span key={i} className={`v-vec-cell ${v < 0 ? 'neg' : 'pos'}`} style={{ ['--a' as string]: Math.min(1, Math.abs(v)) }}>
          {v.toFixed(2)}
        </span>
      ))}
    </div>
  )
}
