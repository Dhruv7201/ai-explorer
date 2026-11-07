import type { FlowStep, InputValues, Machine } from '../types'
import { SdBars, SdGrid, SdText } from './details'
import { Bars, Cells } from './visuals'

const IMAGES: Record<string, string[]> = {
  'Digit 1': ['...#...', '..##...', '...#...', '...#...', '...#...', '...#...', '..###..'],
  'Digit 7': ['#######', '.....#.', '....#..', '...#...', '..#....', '..#....', '..#....'],
  'Digit 0': ['.#####.', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '.#####.'],
  'Digit 4': ['#...#..', '#...#..', '#...#..', '#######', '....#..', '....#..', '....#..'],
}
const FILTERS: Record<string, number[][]> = {
  'Vertical edges': [[-1, 2, -1], [-1, 2, -1], [-1, 2, -1]],
  'Horizontal edges': [[-1, -1, -1], [2, 2, 2], [-1, -1, -1]],
  'Diagonal edges': [[-1, -1, 2], [-1, 2, -1], [2, -1, -1]],
}
const toPx = (img: string[]): number[][] => img.map((r) => [...r].map((c) => (c === '#' ? 1 : 0)))

function conv(px: number[][], k: number[][]) {
  const out: number[][] = []
  for (let r = 0; r + 3 <= px.length; r++) {
    out.push([])
    for (let c = 0; c + 3 <= px[0].length; c++) {
      let s = 0
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += px[r + i][c + j] * k[i][j]
      out[r].push(s)
    }
  }
  return out
}
const relu = (m: number[][]) => m.map((r) => r.map((v) => Math.max(0, v)))
function pool(m: number[][]) {
  const out: number[][] = []
  for (let r = 0; r + 1 < m.length; r += 2) {
    out.push([])
    for (let c = 0; c + 1 < m[0].length; c += 2) out[out.length - 1].push(Math.max(m[r][c], m[r][c + 1], m[r + 1][c], m[r + 1][c + 1]))
  }
  return out
}
const norm = (m: number[][]) => {
  const top = Math.max(1, ...m.flat())
  return m.map((r) => r.map((v) => Math.max(0, v) / top))
}
/** Feature vector: pooled maps from all three filters. */
const features = (px: number[][]) => Object.values(FILTERS).flatMap((k) => pool(relu(conv(px, k))).flat())
const cosine = (a: number[], b: number[]) => {
  const d = a.reduce((s, v, i) => s + v * b[i], 0)
  return d / (Math.hypot(...a) * Math.hypot(...b) || 1)
}

function compute(input: InputValues) {
  const name = (input.image as string) in IMAGES ? (input.image as string) : 'Digit 7'
  const fname = (input.filter as string) in FILTERS ? (input.filter as string) : 'Vertical edges'
  const noise = Number(input.noise ?? 0)
  const px = toPx(IMAGES[name])
  // Deterministic "smudges": flip a few pixels.
  for (let i = 0; i < noise; i++) {
    const r = (i * 5 + 3) % 7
    const c = (i * 3 + 1) % 7
    px[r][c] = 1 - px[r][c]
  }
  const k = FILTERS[fname]
  const map = conv(px, k)
  const pooled = pool(relu(map))
  const f = features(px)
  const scores = Object.keys(IMAGES).map((n) => [n.replace('Digit ', ''), Math.max(0, cosine(f, features(toPx(IMAGES[n]))))] as [string, number])
  const total = scores.reduce((s, [, v]) => s + Math.exp(v * 8), 0)
  const probs = scores.map(([n, v]) => [n, Math.exp(v * 8) / total] as [string, number])
  const best = probs.reduce((a, b) => (b[1] > a[1] ? b : a))
  return { name, fname, noise, px, k, map, pooled, f, probs, best }
}

function run(input: InputValues): FlowStep[] {
  const { name, fname, noise, px, k, map, pooled, f, probs, best } = compute(input)

  return [
    {
      from: 'image',
      to: 'filter',
      title: 'An image is a grid of numbers',
      caption: 'Each pixel is a number: 1 for ink, 0 for paper. Convolutional networks (LeCun’s LeNet read cheque digits in 1998) look at images in small patches.',
      parcel: { name: `${name} (7×7)`, fields: [{ k: 'pixels', v: '49' }, { k: 'smudged pixels', v: String(noise) }], visual: <Cells grid={px} size={16} /> },
      memory: { filter: [{ k: 'kernel', v: k.map((r) => r.join(' ')).join(' / ') }] },
    },
    {
      from: 'filter',
      to: 'map',
      title: `Slide the ${fname.toLowerCase()} filter`,
      caption: 'A 3×3 filter slides across the image. At each spot it multiplies and sums, lighting up where its pattern appears. In real CNNs the filters are learned, not designed.',
      parcel: { name: 'Feature map (5×5)', fields: [{ k: 'filter', v: fname }, { k: 'strongest response', v: String(Math.max(...map.flat())) }], visual: <Cells grid={norm(map)} size={20} /> },
    },
    {
      from: 'map',
      to: 'pool',
      title: 'Keep the strong signals',
      caption: 'ReLU zeroes negative values, then pooling keeps only the strongest response in each 2×2 block. The network now cares what is there, not exactly where.',
      parcel: { name: 'Pooled (2×2)', fields: pooled.flat().map((v, i) => ({ k: `cell ${i + 1}`, v: String(v) })), visual: <Cells grid={norm(pooled)} size={28} /> },
    },
    {
      from: 'pool',
      to: 'classifier',
      title: 'Stack features from every filter',
      caption: 'Pooled maps from all three filters form a feature vector. Deeper layers would combine edges into strokes, and strokes into whole digits.',
      parcel: { name: 'Feature vector', fields: [{ k: 'length', v: String(f.length) }, { k: 'filters used', v: '3' }] },
    },
    {
      from: 'classifier',
      to: 'label',
      title: `Looks like a ${best[0]}`,
      caption: 'The final layer turns features into a probability for each class. Add smudges and watch confidence drop. In 2012, a much deeper CNN (AlexNet) won ImageNet and kicked off the deep-learning boom.',
      parcel: { name: 'Prediction', fields: probs.map(([n, p]) => ({ k: n, v: `${(p * 100).toFixed(0)}%` })), visual: <Bars items={probs} max={1} highlight={best[0]} /> },
      memory: { label: [{ k: 'digit', v: best[0] }, { k: 'confidence', v: `${(best[1] * 100).toFixed(0)}%` }] },
    },
  ]
}

function Kernel({ k }: { k: number[][] }) {
  return (
    <>
      {k.flatMap((row, r) =>
        row.map((v, c) => (
          <g key={`${r}-${c}`} transform={`translate(${c * 34} ${r * 26})`}>
            <rect width={32} height={24} rx={3} className="sd-cell" style={{ fill: v > 0 ? 'color-mix(in srgb, var(--pos) 45%, transparent)' : 'color-mix(in srgb, var(--neg) 30%, transparent)' }} />
            <text x={16} y={16} textAnchor="middle" className="sd-text">{v}</text>
          </g>
        )),
      )}
    </>
  )
}

function details(input: InputValues) {
  const { px, k, map, pooled, f, probs, best, fname } = compute(input)
  return {
    image: <SdGrid grid={px} cell={21} />,
    filter: (
      <>
        <Kernel k={k} />
        <SdText text={fname} y={92} />
      </>
    ),
    map: <SdGrid grid={norm(map)} cell={21} />,
    pool: (
      <>
        <SdGrid grid={norm(pooled)} cell={26} />
        <g transform="translate(64 0)">
          <SdText text="max of each" y={18} />
          <SdText text="2×2 block" y={32} />
        </g>
      </>
    ),
    classifier: (
      <>
        <SdGrid grid={[f.map((v) => v / Math.max(1, ...f))]} cell={12} />
        <SdText text={`${f.length} features`} y={30} />
      </>
    ),
    label: <SdBars items={probs} width={176} max={1} highlight={best[0]} />,
  }
}

export const cnnMachine: Machine = {
  id: 'cnn',
  era: 'neural',
  year: 1998,
  name: 'Convolutional network',
  oneLiner: 'Small filters slide over an image to find edges, then shapes, then objects.',
  groups: [
    { label: 'Input image', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Feature extraction', x: 250, y: 40, w: 390, h: 412, tone: 'pink' },
    { label: 'Classify', x: 656, y: 40, w: 230, h: 412, tone: 'orange' },
  ],
  stations: [
    { id: 'image', name: 'Image', role: 'A grid of pixel values.', x: 124, y: 222, w: 190, h: 200, tone: 'blue', icon: 'image' },
    { id: 'filter', name: 'Filter', role: 'A 3×3 pattern detector slid across the image.', x: 345, y: 150, w: 170, h: 136, tone: 'pink', icon: 'grid' },
    { id: 'map', name: 'Feature map', role: 'Where in the image the pattern appears.', x: 548, y: 150, w: 160, h: 150, tone: 'pink', icon: 'attention', stack: '× many filters' },
    { id: 'pool', name: 'ReLU + pool', role: 'Keeps strong signals and shrinks the map.', x: 548, y: 360, w: 160, h: 96, tone: 'purple', icon: 'layers' },
    { id: 'classifier', name: 'Classifier', role: 'Turns features into class scores.', x: 771, y: 360, w: 200, h: 96, tone: 'orange', icon: 'brain' },
    { id: 'label', name: 'Prediction', role: 'The predicted digit.', x: 771, y: 150, w: 200, h: 136, tone: 'green', icon: 'chart' },
  ],
  wires: [
    ['image', 'filter'],
    ['filter', 'map'],
    ['map', 'pool'],
    ['pool', 'classifier'],
    ['classifier', 'label'],
  ],
  inputs: [
    { key: 'image', label: 'Image', kind: 'select', options: Object.keys(IMAGES) },
    { key: 'filter', label: 'Filter', kind: 'select', options: Object.keys(FILTERS) },
    { key: 'noise', label: 'Smudges', kind: 'slider', min: 0, max: 8 },
  ],
  defaults: { image: 'Digit 7', filter: 'Vertical edges', noise: 0 },
  run,
  details,
}
