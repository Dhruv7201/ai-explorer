/** SVG mini-visuals drawn inside diagram stations. Coordinates start at the station's content area. */

const mix = (a: number, colour = 'var(--amber)') => `color-mix(in srgb, ${colour} ${Math.round(Math.max(0, Math.min(1, a)) * 100)}%, transparent)`

export function SdText({ text, max = 32, strong = false, y = 10 }: { text: string; max?: number; strong?: boolean; y?: number }) {
  return (
    <text y={y} className={strong ? 'sd-strong' : 'sd-text'}>
      {text.length > max ? `${text.slice(0, max - 1)}…` : text}
    </text>
  )
}

/** Token-like chips that wrap onto a second row. */
export function SdChips({ items, width, max = 12 }: { items: string[]; width: number; max?: number }) {
  let x = 0
  let y = 0
  const out = []
  for (const [i, t] of items.slice(0, max).entries()) {
    const w = t.length * 6.1 + 10
    if (x + w > width) {
      x = 0
      y += 22
    }
    if (y > 22) break
    out.push(
      <g key={i} className="sd-chip" transform={`translate(${x} ${y})`}>
        <rect width={w} height={18} rx={4} />
        <text x={5} y={12.5}>{t}</text>
      </g>,
    )
    x += w + 4
  }
  return <>{out}</>
}

/** Rows of coloured cells, one row per labelled vector (values roughly −1..1). */
export function SdVectors({ rows, cell = 18 }: { rows: { label: string; values: number[] }[]; cell?: number }) {
  return (
    <>
      {rows.map((r, i) => (
        <g key={i} transform={`translate(0 ${i * 14})`}>
          <text y={9.5} className="sd-text">{r.label.slice(0, 7)}</text>
          {r.values.map((v, j) => (
            <rect
              key={j}
              x={52 + j * (cell + 2)}
              width={cell}
              height={11}
              rx={2}
              className="sd-cell"
              style={{ fill: mix(Math.abs(v), v < 0 ? 'var(--neg)' : 'var(--pos)') }}
            />
          ))}
        </g>
      ))}
    </>
  )
}

/** Heatmap of values 0..1 with row labels. */
export function SdHeat({ labels, values, maxH }: { labels: string[]; values: number[][]; maxH: number }) {
  const n = values.length
  const c = Math.min(15, Math.floor(maxH / n))
  return (
    <>
      {values.map((row, i) => (
        <g key={i} transform={`translate(0 ${i * c})`}>
          <text y={c * 0.72} className="sd-text">{labels[i].slice(0, 5)}</text>
          {row.map((v, j) => (
            <rect key={j} x={40 + j * c} width={c - 1.5} height={c - 1.5} rx={2} className="sd-cell" style={{ fill: mix(v) }} />
          ))}
        </g>
      ))}
    </>
  )
}

/** Horizontal bars with labels and values. */
export function SdBars({ items, width, highlight, max, format }: { items: [string, number][]; width: number; highlight?: string; max?: number; format?: (v: number) => string }) {
  const top = max ?? Math.max(...items.map(([, v]) => v), 1e-9)
  const track = width - 90
  return (
    <>
      {items.map(([label, v], i) => (
        <g key={i} transform={`translate(0 ${i * 21})`}>
          <text y={11} className="sd-text">{label.slice(0, 8)}</text>
          <rect x={56} y={2} width={track} height={11} rx={2} className="sd-bar-track" />
          <rect x={56} y={2} width={Math.max(1, (v / top) * track)} height={11} rx={2} className={`sd-bar ${label === highlight ? 'hl' : ''}`} />
          <text x={width - 2} y={11} textAnchor="end" className="sd-text">{format ? format(v) : v < 1 ? `${Math.round(v * 100)}%` : Math.round(v)}</text>
        </g>
      ))}
    </>
  )
}

/** A grid of cells: numbers 0..1 shade with the accent; strings map to semantic classes. */
export function SdGrid({ grid, cell }: { grid: (number | string)[][]; cell: number }) {
  const fillFor = (v: number | string) =>
    typeof v === 'number'
      ? mix(v)
      : v === 'wall' ? 'var(--ink)' : v === 'path' ? 'var(--amber)' : v === 'seen' ? mix(0.35, 'var(--ink-2)') : v === 'start' ? 'var(--pos)' : v === 'goal' ? 'var(--neg)' : 'transparent'
  return (
    <>
      {grid.map((row, r) =>
        row.map((v, c) => (
          <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell - 1} height={cell - 1} rx={1.5} className="sd-cell" style={{ fill: fillFor(v) }} />
        )),
      )}
    </>
  )
}

/** Word-wrapped text over a few lines. */
export function SdLines({ text, max = 30, lines = 3, strong = false, y = 10 }: { text: string; max?: number; lines?: number; strong?: boolean; y?: number }) {
  const words = text.split(/\s+/)
  const out: string[] = ['']
  for (const w of words) {
    const cur = out[out.length - 1]
    if ((cur + ' ' + w).trim().length > max && cur) out.push(w)
    else out[out.length - 1] = (cur + ' ' + w).trim()
  }
  const shown = out.slice(0, lines)
  if (out.length > lines) shown[lines - 1] = `${shown[lines - 1].slice(0, max - 1)}…`
  return (
    <>
      {shown.map((l, i) => (
        <text key={i} y={y + i * (strong ? 16 : 14)} className={strong ? 'sd-strong' : 'sd-text'}>
          {l}
        </text>
      ))}
    </>
  )
}

/** Tiny scatter plot of 0..10 data with an optional query square and radius. */
export function SdScatter({ points, query, radius, size = 120 }: { points: { x: number; y: number; cls: string; near?: boolean }[]; query?: { x: number; y: number }; radius?: number; size?: number }) {
  const s = (v: number) => (v / 10) * size
  const t = (v: number) => size - (v / 10) * size
  return (
    <>
      <rect width={size} height={size} rx={4} className="sd-bar-track" />
      {query && radius !== undefined && <circle cx={s(query.x)} cy={t(query.y)} r={s(radius) + 4} className="sd-radius" />}
      {points.map((p, i) => (
        <circle key={i} cx={s(p.x)} cy={t(p.y)} r={p.near ? 3.6 : 2.6} className={`sd-dot ${p.cls} ${p.near ? 'near' : ''}`} />
      ))}
      {query && <rect x={s(query.x) - 4.5} y={t(query.y) - 4.5} width={9} height={9} rx={2} className="sd-query" />}
    </>
  )
}

/** 3×3 game board. */
export function SdBoard({ cells, hl, cell = 30 }: { cells: string[]; hl?: number; cell?: number }) {
  return (
    <>
      {cells.map((c, i) => (
        <g key={i} transform={`translate(${(i % 3) * cell} ${Math.floor(i / 3) * cell})`}>
          <rect width={cell - 2} height={cell - 2} rx={3} className="sd-cell" style={{ fill: i === hl ? 'var(--amber)' : 'transparent' }} />
          <text x={(cell - 2) / 2} y={cell * 0.66} textAnchor="middle" className={i === hl ? 'sd-board hl' : 'sd-board'}>
            {c || (i === hl ? '●' : '')}
          </text>
        </g>
      ))}
    </>
  )
}

export interface PlotPoint {
  x: number
  y: number
  cls: string
  r?: number
}
export interface PlotLine {
  x1: number
  y1: number
  x2: number
  y2: number
  cls?: string
}

/** Clips a segment to the 0..10 square (Liang–Barsky), so lines never spill out of the plot. */
function clipLine(l: PlotLine): PlotLine | null {
  let t0 = 0
  let t1 = 1
  const dx = l.x2 - l.x1
  const dy = l.y2 - l.y1
  const checks: [number, number][] = [[-dx, l.x1], [dx, 10 - l.x1], [-dy, l.y1], [dy, 10 - l.y1]]
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return null
      continue
    }
    const r = q / p
    if (p < 0) t0 = Math.max(t0, r)
    else t1 = Math.min(t1, r)
    if (t0 > t1) return null
  }
  return { ...l, x1: l.x1 + t0 * dx, y1: l.y1 + t0 * dy, x2: l.x1 + t1 * dx, y2: l.y1 + t1 * dy }
}

/** Small 2-D plot over a 0..10 square: points, lines and optional big markers (e.g. centroids). */
export function SdPlot({ points, lines = [], marks = [], w = 130, h = 110 }: { points: PlotPoint[]; lines?: PlotLine[]; marks?: PlotPoint[]; w?: number; h?: number }) {
  const sx = (v: number) => (Math.max(0, Math.min(10, v)) / 10) * w
  const sy = (v: number) => h - (Math.max(0, Math.min(10, v)) / 10) * h
  const shown = lines.map(clipLine).filter((l): l is PlotLine => l !== null)
  return (
    <>
      <rect width={w} height={h} rx={4} className="sd-bar-track" />
      {shown.map((l, i) => (
        <line key={i} x1={sx(l.x1)} y1={sy(l.y1)} x2={sx(l.x2)} y2={sy(l.y2)} className={`sd-plotline ${l.cls ?? ''}`} />
      ))}
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={p.r ?? 2.8} className={`sd-dot ${p.cls}`} />
      ))}
      {marks.map((p, i) => (
        <g key={`m${i}`} transform={`translate(${sx(p.x)} ${sy(p.y)})`} className={`sd-mark ${p.cls}`}>
          <path d="M-5 -5 L5 5 M5 -5 L-5 5" />
        </g>
      ))}
    </>
  )
}
