import type { FlowStep, InputValues, Machine } from '../types'
import { SdBars, SdPlot, SdText } from './details'
import { fx, rng } from './util'

// Three natural blobs of customers (spend vs visits), generated deterministically.
const POINTS: [number, number][] = (() => {
  const r = rng(7)
  const blobs: [number, number][] = [[2.5, 2.5], [7, 3], [5, 7.5]]
  return blobs.flatMap(([cx, cy]) => Array.from({ length: 10 }, () => [cx + (r() - 0.5) * 2.6, cy + (r() - 0.5) * 2.6] as [number, number]))
})()

const d2 = (a: [number, number], b: [number, number]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2

function kmeans(k: number, iters: number, seed: number) {
  const r = rng(seed * 101 + 3)
  let centres: [number, number][] = Array.from({ length: k }, () => POINTS[Math.floor(r() * POINTS.length)])
  const start = centres
  let assign = POINTS.map(() => 0)
  const inertia: number[] = []
  for (let it = 0; it <= iters; it++) {
    assign = POINTS.map((p) => centres.reduce((best, c, i) => (d2(p, c) < d2(p, centres[best]) ? i : best), 0))
    inertia.push(POINTS.reduce((s, p, i) => s + d2(p, centres[assign[i]]), 0))
    if (it === iters) break
    centres = centres.map((c, i) => {
      const mine = POINTS.filter((_, j) => assign[j] === i)
      return mine.length ? [mine.reduce((s, p) => s + p[0], 0) / mine.length, mine.reduce((s, p) => s + p[1], 0) / mine.length] : c
    })
  }
  return { start, centres, assign, inertia }
}

function compute(input: InputValues) {
  const k = Number(input.k ?? 3)
  const iters = Number(input.iters ?? 4)
  const seed = Number(input.seed ?? 1)
  return { k, iters, seed, ...kmeans(k, iters, seed) }
}

function run(input: InputValues): FlowStep[] {
  const { k, iters, centres, assign, inertia } = compute(input)
  const sizes = centres.map((_, i) => assign.filter((a) => a === i).length)
  return [
    {
      from: 'points',
      to: 'init',
      title: `${POINTS.length} customers, no labels`,
      caption: 'Unsupervised learning finds structure without any right answers. K-means (Lloyd’s algorithm, 1957) groups similar points into k clusters.',
      parcel: { name: 'Unlabelled data', fields: [{ k: 'points', v: String(POINTS.length) }, { k: 'features', v: 'spend, visits' }] },
    },
    {
      from: 'init',
      to: 'assign',
      title: `Drop ${k} centres at random`,
      caption: 'Pick k starting centres, here k random customers. A bad start can give a worse answer; try another seed.',
      parcel: { name: 'Starting centres', fields: kmeans(k, 0, Number(input.seed ?? 1)).start.map((c, i) => ({ k: `centre ${i + 1}`, v: `(${fx(c[0], 1)}, ${fx(c[1], 1)})` })) },
    },
    {
      from: 'assign',
      to: 'update',
      title: 'Each point joins its nearest centre',
      caption: 'Every point is assigned to the closest centre, forming k groups.',
      parcel: { name: 'Assignments', fields: sizes.map((s, i) => ({ k: `cluster ${i + 1}`, v: `${s} points` })) },
    },
    {
      from: 'update',
      to: 'assign',
      title: 'Move each centre to the middle of its group',
      caption: `Each centre moves to the average of its points. Then assign again, move again, and repeat. After ${iters} rounds the centres barely move: it has converged.`,
      parcel: {
        name: 'Spread inside clusters',
        fields: inertia.map((v, i) => ({ k: `round ${i}`, v: fx(v, 1) })).slice(0, 6),
      },
      memory: { update: [{ k: 'rounds', v: String(iters) }] },
    },
    {
      from: 'update',
      to: 'result',
      title: `${k} customer groups`,
      caption: 'The result is k groups of similar customers, useful for marketing, image compression or spotting anomalies. Choosing k is up to you: watch how the spread drops as k grows (the “elbow” method).',
      parcel: { name: 'Clusters', fields: [...sizes.map((s, i) => ({ k: `group ${i + 1}`, v: `${s} customers` })), { k: 'total spread', v: fx(inertia[inertia.length - 1], 1) }] },
      memory: { result: [{ k: 'groups', v: String(k) }] },
    },
  ]
}

function details(input: InputValues) {
  const { k, start, centres, assign, inertia } = compute(input)
  const pts = POINTS.map(([x, y], i) => ({ x, y, cls: `c${assign[i]}` }))
  return {
    points: <SdPlot points={POINTS.map(([x, y]) => ({ x, y, cls: 'grey' }))} w={166} h={104} />,
    init: <SdPlot points={POINTS.map(([x, y]) => ({ x, y, cls: 'grey', r: 2 }))} marks={start.map(([x, y], i) => ({ x, y, cls: `c${i}` }))} w={156} h={54} />,
    assign: <SdText text={`nearest of ${k} centres`} y={12} />,
    update: <SdBars items={inertia.slice(0, 4).map((v, i) => [`round ${i}`, v] as [string, number])} width={126} format={(v) => fx(v, 0)} />,
    result: <SdPlot points={pts} marks={centres.map(([x, y], i) => ({ x, y, cls: `c${i}` }))} w={176} h={110} />,
  }
}

export const kmeansMachine: Machine = {
  id: 'k-means',
  era: 'ml',
  year: 1957,
  name: 'K-means clustering',
  oneLiner: 'Group unlabelled data by repeatedly assigning points to the nearest centre.',
  groups: [
    { label: 'Unlabelled data', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Assign and move, repeat', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Clusters', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'points', name: 'Customers', role: 'Data points with no labels.', x: 124, y: 230, w: 190, h: 150, tone: 'blue', icon: 'db' },
    { id: 'init', name: 'Starting centres', role: 'k centres placed at random.', x: 350, y: 140, w: 180, h: 100, tone: 'teal', icon: 'grid' },
    { id: 'assign', name: 'Assign', role: 'Each point joins its nearest centre.', x: 350, y: 340, w: 180, h: 70, tone: 'purple', icon: 'route' },
    { id: 'update', name: 'Move centres', role: 'Each centre moves to the mean of its points.', x: 558, y: 340, w: 150, h: 124, tone: 'orange', icon: 'gear', stack: '× repeat' },
    { id: 'result', name: 'Clusters', role: 'The final groups.', x: 771, y: 190, w: 200, h: 160, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['points', 'init'],
    ['init', 'assign'],
    { from: 'assign', to: 'update', label: 'repeat' },
    ['update', 'result'],
  ],
  inputs: [
    { key: 'k', label: 'Number of clusters (k)', kind: 'slider', min: 2, max: 5 },
    { key: 'iters', label: 'Rounds', kind: 'slider', min: 0, max: 8 },
    { key: 'seed', label: 'Random start', kind: 'slider', min: 1, max: 10 },
  ],
  defaults: { k: 3, iters: 4, seed: 1 },
  run,
  details,
}
