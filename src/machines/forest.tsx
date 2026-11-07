import type { FlowStep, InputValues, Machine } from '../types'
import { Bars } from './visuals'
import { SdBars, SdPlot, SdText } from './details'
import { rng } from './util'

// Points in a 10×10 square; class 1 inside a circle, class 0 outside. A single small tree struggles with circles.
type Pt = { x: number; y: number; c: number }
const label = (x: number, y: number) => (Math.hypot(x - 5, y - 5) < 3.2 ? 1 : 0)
const TRAIN: Pt[] = (() => {
  const r = rng(5)
  return Array.from({ length: 70 }, () => {
    const x = r() * 10
    const y = r() * 10
    return { x, y, c: label(x, y) }
  })
})()
const TEST: Pt[] = Array.from({ length: 400 }, (_, i) => {
  const x = (i % 20) / 2 + 0.25
  const y = Math.floor(i / 20) / 2 + 0.25
  return { x, y, c: label(x, y) }
})

type Node = { leaf: number } | { f: 'x' | 'y'; t: number; l: Node; r: Node }
const gini = (pts: Pt[]) => {
  if (!pts.length) return 0
  const p = pts.filter((q) => q.c === 1).length / pts.length
  return 1 - p * p - (1 - p) * (1 - p)
}
const majority = (pts: Pt[]) => (pts.filter((q) => q.c === 1).length * 2 >= pts.length ? 1 : 0)

/** A small decision tree (depth 3) that may only look at a random feature at each split. */
function grow(pts: Pt[], depth: number, rand: () => number): Node {
  if (depth === 0 || pts.length < 4 || gini(pts) === 0) return { leaf: majority(pts) }
  const f: 'x' | 'y' = rand() < 0.5 ? 'x' : 'y'
  let best: { t: number; score: number } | null = null
  for (let t = 0.5; t < 10; t += 0.5) {
    const l = pts.filter((p) => p[f] < t)
    const r = pts.filter((p) => p[f] >= t)
    if (!l.length || !r.length) continue
    const score = (l.length * gini(l) + r.length * gini(r)) / pts.length
    if (!best || score < best.score) best = { t, score }
  }
  if (!best) return { leaf: majority(pts) }
  return { f, t: best.t, l: grow(pts.filter((p) => p[f] < best.t), depth - 1, rand), r: grow(pts.filter((p) => p[f] >= best.t), depth - 1, rand) }
}
const predict = (n: Node, p: { x: number; y: number }): number => ('leaf' in n ? n.leaf : predict(p[n.f] < n.t ? n.l : n.r, p))

const FOREST: Node[] = (() => {
  const rand = rng(99)
  return Array.from({ length: 25 }, () => {
    const sample = Array.from({ length: TRAIN.length }, () => TRAIN[Math.floor(rand() * TRAIN.length)])
    return grow(sample, 3, rand)
  })
})()
const vote = (trees: Node[], p: { x: number; y: number }) => trees.reduce((s, t) => s + predict(t, p), 0)
const accuracy = (trees: Node[]) => TEST.filter((p) => (vote(trees, p) * 2 > trees.length ? 1 : 0) === p.c).length / TEST.length

function compute(input: InputValues) {
  const n = Number(input.trees ?? 15)
  const q = { x: Number(input.qx ?? 6), y: Number(input.qy ?? 4) }
  const trees = FOREST.slice(0, n)
  const yes = vote(trees, q)
  return { n, q, trees, yes, inside: yes * 2 > n, acc1: accuracy(FOREST.slice(0, 1)), accN: accuracy(trees) }
}

function run(input: InputValues): FlowStep[] {
  const { n, q, yes, inside, acc1, accN } = compute(input)
  const curve = [1, 3, 5, 10, 15, 25].map((k) => [`${k} tree${k > 1 ? 's' : ''}`, accuracy(FOREST.slice(0, k))] as [string, number])
  return [
    {
      from: 'data',
      to: 'bootstrap',
      title: `${TRAIN.length} labelled points`,
      caption: 'The rule hidden in the data is a circle: points near the middle are class 1. A single small decision tree can only draw boxy, axis-aligned splits.',
      parcel: { name: 'Training data', fields: [{ k: 'points', v: String(TRAIN.length) }, { k: 'class 1', v: String(TRAIN.filter((p) => p.c).length) }] },
    },
    {
      from: 'bootstrap',
      to: 'trees',
      title: `Make ${n} random samples`,
      caption: 'Each tree gets its own random sample of the data, drawn with replacement (bagging). Some points appear twice, about a third are left out.',
      parcel: { name: 'Bootstrap samples', fields: [{ k: 'samples', v: String(n) }, { k: 'each sample', v: `${TRAIN.length} draws` }] },
    },
    {
      from: 'trees',
      to: 'vote',
      title: `Grow ${n} different trees`,
      caption: 'Each tree also only considers a random feature at each split, so the trees make different mistakes. A random forest (Breiman, 2001) relies on that variety.',
      parcel: { name: 'Trees', fields: [{ k: 'trees', v: String(n) }, { k: 'one tree alone', v: `${Math.round(acc1 * 100)}% accurate` }] },
    },
    {
      from: 'vote',
      to: 'result',
      title: `${yes} of ${n} trees say class 1`,
      caption: `For the point (${q.x}, ${q.y}) every tree votes and the majority wins: ${inside ? 'class 1 (inside)' : 'class 0 (outside)'}.`,
      parcel: { name: 'Votes', fields: [{ k: 'class 1', v: String(yes) }, { k: 'class 0', v: String(n - yes) }] },
      memory: { vote: [{ k: 'class 1 votes', v: `${yes}/${n}` }] },
    },
    {
      from: 'result',
      to: 'result',
      title: `Forest accuracy: ${Math.round(accN * 100)}%`,
      caption: `One tree alone scores ${Math.round(acc1 * 100)}%; ${n} trees together score ${Math.round(accN * 100)}%. Many weak, varied models beat one. Gradient boosting (XGBoost, LightGBM) builds trees one after another, each fixing the last one’s errors, and still wins many contests on tables of data.`,
      parcel: { name: 'Accuracy on test grid', fields: curve.map(([k, v]) => ({ k, v: `${Math.round(v * 100)}%` })), visual: <Bars items={curve} max={1} highlight={`${n} trees`} /> },
      memory: { result: [{ k: 'accuracy', v: `${Math.round(accN * 100)}%` }] },
    },
  ]
}

function details(input: InputValues) {
  const { n, q, trees, yes, inside, acc1, accN } = compute(input)
  // Shade the forest's decision on a coarse grid.
  const grid = Array.from({ length: 100 }, (_, i) => ({ x: (i % 10) + 0.5, y: Math.floor(i / 10) + 0.5 }))
  return {
    data: <SdPlot points={TRAIN.map((p) => ({ x: p.x, y: p.y, cls: p.c ? 'c1' : 'c0' }))} w={166} h={104} />,
    bootstrap: <SdText text={`${n} random samples`} y={12} />,
    trees: (
      <>
        <SdText text={`${n} trees, depth 3`} strong y={12} />
        <SdText text="random feature per split" y={30} />
      </>
    ),
    vote: <SdBars items={[['class 1', yes], ['class 0', n - yes]]} width={126} max={n} highlight={inside ? 'class 1' : 'class 0'} format={String} />,
    result: (
      <>
        <SdPlot
          points={[
            ...grid.map((g) => ({ x: g.x, y: g.y, r: 3.6, cls: vote(trees, g) * 2 > trees.length ? 'c1' : 'grey' })),
            { x: q.x, y: q.y, r: 4.5, cls: 'c3 sv' },
          ]}
          w={110}
          h={110}
        />
        <g transform="translate(120 0)">
          <SdText text={`${Math.round(accN * 100)}%`} strong y={14} />
          <SdText text="forest" y={30} />
          <SdText text={`${Math.round(acc1 * 100)}%`} y={56} />
          <SdText text="1 tree" y={70} />
        </g>
      </>
    ),
  }
}

export const forestMachine: Machine = {
  id: 'random-forest',
  era: 'ml',
  year: 2001,
  name: 'Random forest',
  oneLiner: 'Many varied decision trees vote together, beating any single tree.',
  groups: [
    { label: 'Data', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Build a crowd of trees', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Vote', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'data', name: 'Training data', role: 'Labelled points; the true rule is a circle.', x: 124, y: 230, w: 190, h: 150, tone: 'blue', icon: 'db' },
    { id: 'bootstrap', name: 'Random samples', role: 'Each tree gets its own sample, drawn with replacement.', x: 350, y: 140, w: 180, h: 66, tone: 'teal', icon: 'route' },
    { id: 'trees', name: 'Trees', role: 'Small decision trees, each slightly different.', x: 350, y: 340, w: 180, h: 80, tone: 'purple', icon: 'layers', stack: '× N trees' },
    { id: 'vote', name: 'Majority vote', role: 'Every tree votes; the most common answer wins.', x: 558, y: 250, w: 150, h: 90, tone: 'orange', icon: 'chart' },
    { id: 'result', name: 'Result', role: 'The forest’s prediction and accuracy.', x: 771, y: 240, w: 200, h: 156, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['data', 'bootstrap'],
    ['bootstrap', 'trees'],
    ['trees', 'vote'],
    ['vote', 'result'],
  ],
  inputs: [
    { key: 'trees', label: 'Number of trees', kind: 'slider', min: 1, max: 25, step: 2 },
    { key: 'qx', label: 'New point x', kind: 'slider', min: 0, max: 10, step: 0.5 },
    { key: 'qy', label: 'New point y', kind: 'slider', min: 0, max: 10, step: 0.5 },
  ],
  defaults: { trees: 15, qx: 6, qy: 4 },
  run,
  details,
}
