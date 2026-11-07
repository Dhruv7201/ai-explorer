import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Field, FlowStep, Machine, Station, Tone, Wire } from '../types'
import { IconGlyph, iconFor } from './icons'

const VIEW_W = 900
const VIEW_H = 460
const TRAVEL_MS = 1250
const DOCK = 20 // gap between a docked parcel and the top of its station
const TONES: Tone[] = ['blue', 'teal', 'purple', 'orange', 'pink', 'green']

type Pt = { x: number; y: number }
const size = (s: Station) => ({ w: s.w ?? 150, h: s.h ?? 58 })
const norm = (w: Wire) => (Array.isArray(w) ? { from: w[0], to: w[1] } : w)

/** Wire geometry between box edges, so arrowheads land on the box outline. */
function wirePath(a: Station, b: Station, route?: 'above' | 'below') {
  const A = size(a)
  const B = size(b)
  if (route) {
    const dir = route === 'above' ? -1 : 1
    const yy = route === 'above' ? Math.min(a.y - A.h / 2, b.y - B.h / 2) - 24 : Math.max(a.y + A.h / 2, b.y + B.h / 2) + 24
    const r = 12
    const sx = Math.sign(b.x - a.x) || 1
    return `M${a.x},${a.y + (dir * A.h) / 2} V${yy - dir * r} Q${a.x},${yy} ${a.x + sx * r},${yy} H${b.x - sx * r} Q${b.x},${yy} ${b.x},${yy - dir * r} V${b.y + (dir * B.h) / 2}`
  }
  const dx = b.x - a.x
  const dy = b.y - a.y
  const gapX = Math.abs(dx) - (A.w + B.w) / 2
  const gapY = Math.abs(dy) - (A.h + B.h) / 2
  if (gapX >= gapY) {
    // Side to side.
    const sx = Math.sign(dx) || 1
    const x0 = a.x + (sx * A.w) / 2
    const x1 = b.x - (sx * B.w) / 2
    // Boxes share some height: one straight line through the shared band.
    const top = Math.max(a.y - A.h / 2, b.y - B.h / 2) + 10
    const bot = Math.min(a.y + A.h / 2, b.y + B.h / 2) - 10
    if (bot >= top) {
      const y = Math.min(Math.max((a.y + b.y) / 2, top), bot)
      return `M${x0},${y} H${x1}`
    }
    return elbowH(x0, a.y, x1, b.y)
  }
  // Up and down.
  const sy = Math.sign(dy) || 1
  const y0 = a.y + (sy * A.h) / 2
  const y1 = b.y - (sy * B.h) / 2
  const left = Math.max(a.x - A.w / 2, b.x - B.w / 2) + 14
  const right = Math.min(a.x + A.w / 2, b.x + B.w / 2) - 14
  if (right >= left) {
    const x = Math.min(Math.max((a.x + b.x) / 2, left), right)
    return `M${x},${y0} V${y1}`
  }
  return elbowV(a.x, y0, b.x, y1)
}

/** Right-angle connector: across, then up or down, then across, with rounded corners. */
function elbowH(x0: number, y0: number, x1: number, y1: number) {
  const sx = Math.sign(x1 - x0) || 1
  const sy = Math.sign(y1 - y0) || 1
  // Upward and downward elbows between the same columns use separate lanes so they never merge.
  const mx = (x0 + x1) / 2 + sy * 7
  const r = Math.min(12, Math.abs(y1 - y0) / 2, Math.abs(x1 - x0) / 4)
  return `M${x0},${y0} H${mx - sx * r} Q${mx},${y0} ${mx},${y0 + sy * r} V${y1 - sy * r} Q${mx},${y1} ${mx + sx * r},${y1} H${x1}`
}

/** Right-angle connector: down or up, then across, then down or up, with rounded corners. */
function elbowV(x0: number, y0: number, x1: number, y1: number) {
  const sx = Math.sign(x1 - x0) || 1
  const sy = Math.sign(y1 - y0) || 1
  const my = (y0 + y1) / 2 + sx * 7
  const r = Math.min(12, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 4)
  return `M${x0},${y0} V${my - sy * r} Q${x0},${my} ${x0 + sx * r},${my} H${x1 - sx * r} Q${x1},${my} ${x1},${my + sy * r} V${y1}`
}

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2)
const lerp = (a: Pt, b: Pt, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface Props {
  machine: Machine
  steps: FlowStep[]
  step: FlowStep
  stepKey: string
  memory: Record<string, Field[]>
  details: Partial<Record<string, ReactNode>>
  backdrop?: ReactNode
  selectedStation?: string
  parcelSelected: boolean
  onSelectStation: (id: string) => void
  onSelectParcel: () => void
}

export function Diagram(props: Props) {
  const { machine, steps, step, stepKey, memory, details, backdrop, selectedStation, parcelSelected, onSelectStation, onSelectParcel } = props
  const byId: Record<string, Station> = useMemo(() => Object.fromEntries(machine.stations.map((s) => [s.id, s])), [machine])
  const wrapRef = useRef<HTMLDivElement>(null)
  const parcelRef = useRef<HTMLButtonElement>(null)
  const liveRef = useRef<SVGPathElement>(null)
  const last = useRef<Pt>({ x: 0, y: 0 })
  const [arrived, setArrived] = useState(true)

  // Step badges follow the order stations first appear in the flow; wires point the way data first travels.
  const { order, wires } = useMemo(() => {
    const order: Record<string, number> = {}
    const dir = new Map<string, boolean>()
    let n = 0
    for (const s of steps) {
      for (const id of [s.from, s.to]) if (!(id in order)) order[id] = ++n
      if (s.from !== s.to) {
        const k = [s.from, s.to].sort().join('|')
        if (!dir.has(k)) dir.set(k, s.from < s.to)
      }
    }
    const wires = machine.wires.map(norm).map((w) => {
      const k = [w.from, w.to].sort().join('|')
      const forward = dir.has(k) ? dir.get(k) === w.from < w.to : true
      return forward ? w : { ...w, from: w.to, to: w.from }
    })
    return { order, wires }
  }, [steps, machine])

  const from = byId[step.from]
  const to = byId[step.to]
  const moving = step.from !== step.to
  const activeWire = wires.find((w) => (w.from === step.from && w.to === step.to) || (w.from === step.to && w.to === step.from))
  const activeD = moving ? wirePath(from, to, activeWire?.route) : null
  /** Where the parcel rests at a station: above it if there is room, otherwise below, left or right. */
  const dockOf = (s: Station): Pt => {
    const { w, h } = size(s)
    const pw = Math.min(150, step.parcel.name.length * 7 + 26)
    const ph = 26
    const spots: Pt[] = [
      { x: s.x, y: s.y - h / 2 - DOCK },
      { x: s.x, y: s.y + h / 2 + DOCK },
      { x: s.x - w / 2 - pw / 2 - 10, y: s.y },
      { x: s.x + w / 2 + pw / 2 + 10, y: s.y },
    ]
    const free = (p: Pt) =>
      p.x - pw / 2 >= 0 &&
      p.x + pw / 2 <= VIEW_W &&
      p.y - ph / 2 >= 0 &&
      p.y + ph / 2 <= VIEW_H &&
      machine.stations.every((o) => {
        if (o.id === s.id) return true
        const b = size(o)
        return p.x + pw / 2 < o.x - b.w / 2 - 4 || p.x - pw / 2 > o.x + b.w / 2 + 4 || p.y + ph / 2 < o.y - b.h / 2 - 4 || p.y - ph / 2 > o.y + b.h / 2 + 4
      })
    return spots.find(free) ?? spots[0]
  }

  /** Writes the parcel position straight to the DOM: no React render per frame. */
  const place = (p: Pt) => {
    last.current = p
    const wrap = wrapRef.current
    const el = parcelRef.current
    if (!wrap || !el) return
    const s = wrap.clientWidth / VIEW_W
    el.style.transform = `translate3d(${p.x * s}px, ${p.y * s}px, 0) translate(-50%, -50%)`
  }

  useLayoutEffect(() => {
    const end = dockOf(to)
    const path = liveRef.current
    if (!moving || !path || reducedMotion()) {
      place(end)
      setArrived(true)
      return
    }
    setArrived(false)
    const start = dockOf(from)
    const len = path.getTotalLength()
    const p0 = path.getPointAtLength(0)
    const p1 = path.getPointAtLength(len)
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / TRAVEL_MS)
      const t = easeInOut(p)
      // Lift off the dock, ride the wire, settle onto the next dock.
      if (t < 0.15) place(lerp(start, p0, t / 0.15))
      else if (t > 0.85) place(lerp(p1, end, (t - 0.85) / 0.15))
      else {
        const q = path.getPointAtLength(((t - 0.15) / 0.7) * len)
        place({ x: q.x, y: q.y })
      }
      if (p < 1) raf = requestAnimationFrame(tick)
      else setArrived(true)
    }
    place(start)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => place(last.current))
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="diagram-inner" ref={wrapRef}>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="diagram-svg" role="img" aria-label={`${machine.name} diagram`}>
        <defs>
          <marker id="arrow" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M1,1.5 L11,6 L1,10.5 L3.5,6 z" className="arrow-head" />
          </marker>
          <marker id="arrow-live" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="13" markerHeight="13" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M1,1.5 L11,6 L1,10.5 L3.5,6 z" className="arrow-head live" />
          </marker>
        </defs>

        {machine.groups?.map((g) => (
          <g key={g.label} className={`group tone-${g.tone ?? 'blue'}`}>
            <rect x={g.x} y={g.y} width={g.w} height={g.h} rx={16} />
            <text x={g.x + 16} y={g.y + g.h - 13}>{g.label}</text>
          </g>
        ))}

        {backdrop && <g className="backdrop">{backdrop}</g>}

        {wires.map((w) => {
          const d = wirePath(byId[w.from], byId[w.to], w.route)
          const isLive = activeWire === w && moving
          return (
            <g key={`${w.from}-${w.to}`} className={`wire-g ${isLive ? 'is-live' : ''}`}>
              <path d={d} className="wire" markerEnd="url(#arrow)" />
            </g>
          )
        })}

        {activeD && (
          <g key={stepKey}>
            <path ref={liveRef} d={activeD} className="wire-live" pathLength={1} />
            <path d={activeD} className="wire-live-head" markerEnd="url(#arrow-live)" />
            {[0, 0.4, 0.8].map((d) => (
              <circle key={d} r="2.6" className="spark">
                <animateMotion dur="1.2s" begin={`${d}s`} repeatCount="indefinite" path={activeD} />
              </circle>
            ))}
          </g>
        )}

        {wires
          .filter((w) => w.label)
          .map((w) => (
            <WireLabel key={`label-${w.from}-${w.to}`} d={wirePath(byId[w.from], byId[w.to], w.route)} text={w.label!} />
          ))}

        {machine.stations.map((s, i) => {
          const { w, h } = size(s)
          const info = memory[s.id]?.[0]
          const sub = info ? `${info.k}: ${info.v}` : ''
          const maxChars = Math.floor((w - 34) / 6.2)
          const detail = details[s.id]
          const tone = s.tone ?? TONES[i % TONES.length]
          const cls = [
            'station',
            `tone-${tone}`,
            s.id === step.from && moving ? 'is-source' : '',
            s.id === step.to ? 'is-target' : '',
            selectedStation === s.id ? 'is-selected' : '',
          ].join(' ')
          return (
            <g
              key={s.id}
              className={cls}
              transform={`translate(${s.x - w / 2} ${s.y - h / 2})`}
              onClick={() => onSelectStation(s.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectStation(s.id)}
              tabIndex={0}
              role="button"
              aria-label={`Inspect ${s.name}`}
            >
              {s.stack && (
                <>
                  <rect className="stack-card" x={10} y={10} width={w} height={h} rx={12} />
                  <rect className="stack-card" x={5} y={5} width={w} height={h} rx={12} />
                  <text className="stack-label" x={w + 6} y={h + 24} textAnchor="end">{s.stack}</text>
                </>
              )}
              {s.id === step.to && arrived && <rect key={stepKey} className="pulse" width={w} height={h} rx={12} />}
              <rect className="station-body" width={w} height={h} rx={12} />
              <rect className="station-band" width={4} height={h - 20} x={0} y={10} rx={2} />
              <IconGlyph icon={iconFor(s)} x={12} y={11} />
              <text x={34} y={24} className="station-name">{s.name}</text>
              {detail ? (
                <g transform="translate(12 36)" className="station-detail">{detail}</g>
              ) : (
                info && (
                  <text x={12} y={h - 13} className="station-sub">
                    {sub.length > maxChars + 3 ? `${sub.slice(0, maxChars + 2)}…` : sub}
                  </text>
                )
              )}
              {order[s.id] && (
                <g className="badge" transform="translate(0 0)">
                  <circle cx={0} cy={0} r={11} />
                  <text x={0} y={4} textAnchor="middle">{order[s.id]}</text>
                </g>
              )}
            </g>
          )
        })}
      </svg>

      <button
        ref={parcelRef}
        type="button"
        className={`parcel ${parcelSelected ? 'is-selected' : ''} ${arrived ? 'is-docked' : 'is-flying'}`}
        onClick={onSelectParcel}
        aria-label={`Inspect ${step.parcel.name}`}
      >
        <span className="parcel-inner" key={arrived ? `${stepKey}-docked` : stepKey}>
          {step.parcel.name}
        </span>
      </button>
    </div>
  )
}

/** Places a small label at the middle of a wire. */
function WireLabel({ d, text }: { d: string; text: string }) {
  const ref = useRef<SVGPathElement>(null)
  const [pt, setPt] = useState<Pt | null>(null)
  useLayoutEffect(() => {
    const p = ref.current
    if (!p) return
    const q = p.getPointAtLength(p.getTotalLength() / 2)
    setPt({ x: q.x, y: q.y })
  }, [d])
  return (
    <>
      <path ref={ref} d={d} fill="none" stroke="none" />
      {pt && (
        <g className="wire-label" transform={`translate(${pt.x} ${pt.y})`}>
          <rect x={-text.length * 3.2 - 8} y={-10} width={text.length * 6.4 + 16} height={20} rx={10} />
          <text y={4} textAnchor="middle">{text}</text>
        </g>
      )}
    </>
  )
}
