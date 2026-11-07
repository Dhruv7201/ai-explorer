import type { FlowStep, InputValues, Machine } from '../types'
import type { PlotLine } from './details'
import { SdPlot, SdText } from './details'
import { fx } from './util'

const BASE_A: [number, number][] = [[2, 3], [3, 1.8], [2.6, 4.4], [3.8, 3.2], [1.5, 2], [4.2, 1.6], [3.4, 4.6]]
const BASE_B: [number, number][] = [[6.6, 6.4], [7.4, 5.2], [6, 7.8], [8, 7], [7.2, 8.4], [5.8, 6], [8.4, 5.6]]
const OUTLIER: [number, number] = [6.6, 5]

function solve(A: [number, number][], B: [number, number][]) {
  let best: { theta: number; margin: number; c: number } | null = null
  let separable = 0
  for (let deg = 0; deg < 360; deg += 1) {
    const t = (deg * Math.PI) / 180
    const n = [Math.cos(t), Math.sin(t)]
    const pa = A.map(([x, y]) => x * n[0] + y * n[1])
    const pb = B.map(([x, y]) => x * n[0] + y * n[1])
    const gap = Math.min(...pb) - Math.max(...pa)
    if (gap > 0) {
      separable++
      if (!best || gap / 2 > best.margin) best = { theta: t, margin: gap / 2, c: (Math.min(...pb) + Math.max(...pa)) / 2 }
    }
  }
  return { best, separable }
}

function compute(input: InputValues) {
  const gap = Number(input.gap ?? 0.5)
  const withOutlier = Boolean(input.outlier)
  const A = BASE_A.map(([x, y]) => [x - gap, y - gap] as [number, number])
  const B = BASE_B.map(([x, y]) => [x + gap, y + gap] as [number, number])
  const Afull = withOutlier ? [...A, OUTLIER] : A
  const hard = solve(Afull, B)
  // If the outlier makes a straight split impossible, a soft margin lets it sit on the wrong side.
  const used = hard.best ? hard : solve(A, B)
  const { theta, margin, c } = used.best!
  const n = [Math.cos(theta), Math.sin(theta)]
  const proj = (p: [number, number]) => p[0] * n[0] + p[1] * n[1]
  const support = [...A, ...B].filter((p) => Math.abs(Math.abs(proj(p) - c) - margin) < 0.06)
  return { A, B, Afull, n, c, margin, support, separableCount: used.separable, soft: !hard.best }
}

const lineAt = (n: number[], c: number, cls?: string): PlotLine =>
  Math.abs(n[1]) > 0.05
    ? { x1: 0, y1: c / n[1], x2: 10, y2: (c - 10 * n[0]) / n[1], cls }
    : { x1: c / n[0], y1: 0, x2: c / n[0], y2: 10, cls }

function run(input: InputValues): FlowStep[] {
  const { A, B, margin, support, separableCount, soft } = compute(input)
  return [
    {
      from: 'data',
      to: 'candidates',
      title: 'Two classes of points',
      caption: 'A support vector machine (Cortes & Vapnik, 1995) separates two classes with the safest possible line.',
      parcel: { name: 'Training data', fields: [{ k: 'class A', v: `${A.length + (soft ? 1 : 0)} points` }, { k: 'class B', v: `${B.length} points` }] },
    },
    {
      from: 'candidates',
      to: 'margin',
      title: soft ? 'No perfect straight split' : `${separableCount} angles separate them`,
      caption: soft
        ? 'The outlier sits among class B, so no straight line splits the classes perfectly.'
        : 'Many lines split the two groups perfectly. Which one should we trust on new data?',
      parcel: { name: 'Candidate lines', fields: [{ k: 'angles tried', v: '360' }, { k: 'perfect splits', v: soft ? 'none' : String(separableCount) }] },
    },
    {
      from: 'margin',
      to: 'support',
      title: `Widest margin: ${fx(margin * 2)} units`,
      caption: 'The SVM picks the line with the widest empty band (margin) on both sides. A wide margin means small changes in new data are less likely to flip the answer.',
      parcel: { name: 'Margin', fields: [{ k: 'half-width', v: fx(margin) }, { k: 'full width', v: fx(margin * 2) }] },
      memory: { margin: [{ k: 'width', v: fx(margin * 2) }] },
    },
    {
      from: 'support',
      to: 'boundary',
      title: `${support.length} support vectors`,
      caption: 'Only the points touching the margin, the support vectors, decide where the line goes. Delete any other point and the answer stays the same.',
      parcel: { name: 'Support vectors', fields: support.map((p, i) => ({ k: `#${i + 1}`, v: `(${fx(p[0], 1)}, ${fx(p[1], 1)})` })) },
    },
    {
      from: 'boundary',
      to: 'boundary',
      title: soft ? 'Soft margin: allow a mistake' : 'The decision boundary',
      caption: soft
        ? 'A soft-margin SVM pays a penalty to let the outlier sit on the wrong side, and keeps a wide margin for everything else. The “kernel trick” goes further, bending the boundary into curves.'
        : 'New points are classified by which side of the line they fall on. With the “kernel trick”, SVMs can draw curved boundaries too; they were the go-to classifier before deep learning.',
      parcel: { name: 'Classifier', fields: [{ k: 'boundary', v: 'widest-margin line' }, { k: 'mistakes allowed', v: soft ? '1 (soft margin)' : '0' }] },
    },
  ]
}

function details(input: InputValues) {
  const { B, Afull, n, c, margin, support, soft } = compute(input)
  const isSv = (p: [number, number]) => support.some((s) => s[0] === p[0] && s[1] === p[1])
  const pts = [...Afull.map((p) => ({ x: p[0], y: p[1], cls: `c0 ${isSv(p) ? 'sv' : ''}` })), ...B.map((p) => ({ x: p[0], y: p[1], cls: `c1 ${isSv(p) ? 'sv' : ''}` }))]
  const lines = [lineAt(n, c), lineAt(n, c - margin, 'thin'), lineAt(n, c + margin, 'thin')]
  return {
    data: <SdPlot points={pts.map((p) => ({ ...p, cls: p.cls.split(' ')[0] }))} w={166} h={104} />,
    candidates: <SdText text={soft ? 'none split perfectly' : 'many lines work'} y={12} />,
    margin: <SdText text={`margin ${fx(margin * 2)}`} strong y={12} />,
    support: <SdText text={`${support.length} points fix it`} y={12} />,
    boundary: <SdPlot points={pts} lines={lines} w={176} h={116} />,
  }
}

export const svmMachine: Machine = {
  id: 'svm',
  era: 'ml',
  year: 1995,
  name: 'Support vector machine',
  oneLiner: 'Separate two classes with the line that leaves the widest safety margin.',
  groups: [
    { label: 'Data', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Search for the safest line', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Classifier', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'data', name: 'Two classes', role: 'Labelled points from class A and class B.', x: 124, y: 230, w: 190, h: 150, tone: 'blue', icon: 'db' },
    { id: 'candidates', name: 'Candidate lines', role: 'Every straight line that could split the classes.', x: 350, y: 140, w: 180, h: 66, tone: 'teal', icon: 'search' },
    { id: 'margin', name: 'Margin', role: 'The empty band between the line and the nearest points.', x: 350, y: 350, w: 180, h: 66, tone: 'purple', icon: 'chart' },
    { id: 'support', name: 'Support vectors', role: 'The few points that touch the margin and fix the line.', x: 558, y: 250, w: 150, h: 76, tone: 'orange', icon: 'grid' },
    { id: 'boundary', name: 'Decision boundary', role: 'The widest-margin line used to classify new points.', x: 771, y: 240, w: 200, h: 166, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['data', 'candidates'],
    ['candidates', 'margin'],
    ['margin', 'support'],
    ['support', 'boundary'],
  ],
  inputs: [
    { key: 'gap', label: 'Distance between classes', kind: 'slider', min: 0, max: 1.2, step: 0.1 },
    { key: 'outlier', label: 'Add an outlier', kind: 'toggle' },
  ],
  defaults: { gap: 0.5, outlier: false },
  run,
  details,
}
