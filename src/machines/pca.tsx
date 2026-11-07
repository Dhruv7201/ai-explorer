import type { FlowStep, InputValues, Machine } from '../types'
import { SdBars, SdPlot, SdText } from './details'
import { fx, rng } from './util'

// Fixed random draws; the "link" slider controls how strongly the two features move together.
const RAW = (() => {
  const r = rng(11)
  const gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r())
  return Array.from({ length: 40 }, () => [gauss(), gauss()] as [number, number])
})()

function compute(input: InputValues) {
  const rho = Number(input.link ?? 0.85)
  const pts = RAW.map(([a, b]) => [5 + 1.6 * a, 5 + 1.6 * (rho * a + Math.sqrt(1 - rho * rho) * b)] as [number, number])
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const my = pts.reduce((s, p) => s + p[1], 0) / pts.length
  const c = pts.map(([x, y]) => [x - mx, y - my] as [number, number])
  const a = c.reduce((s, p) => s + p[0] * p[0], 0) / (c.length - 1)
  const d = c.reduce((s, p) => s + p[1] * p[1], 0) / (c.length - 1)
  const b = c.reduce((s, p) => s + p[0] * p[1], 0) / (c.length - 1)
  const mid = (a + d) / 2
  const rad = Math.sqrt(((a - d) / 2) ** 2 + b * b)
  const l1 = mid + rad
  const l2 = mid - rad
  let v = Math.abs(b) > 1e-9 ? [b, l1 - a] : a >= d ? [1, 0] : [0, 1]
  const len = Math.hypot(v[0], v[1])
  v = [v[0] / len, v[1] / len]
  const proj = c.map(([x, y]) => x * v[0] + y * v[1])
  return { rho, pts, mx, my, a, b, d, l1, l2, v, proj, explained: l1 / (l1 + l2) }
}

function run(input: InputValues): FlowStep[] {
  const { pts, mx, my, a, b, d, l1, l2, v, explained } = compute(input)
  return [
    {
      from: 'data',
      to: 'center',
      title: `${pts.length} flats, 2 measurements each`,
      caption: 'Real data often has many features that overlap: floor area and number of rooms say nearly the same thing. PCA (Pearson, 1901) finds the few directions that carry most of the information.',
      parcel: { name: 'Data', fields: [{ k: 'points', v: String(pts.length) }, { k: 'features', v: 'floor area, rooms' }] },
    },
    {
      from: 'center',
      to: 'cov',
      title: 'Centre the data',
      caption: 'Subtract the average of each feature so the cloud of points sits around zero.',
      parcel: { name: 'Means removed', fields: [{ k: 'mean area', v: fx(mx) }, { k: 'mean rooms', v: fx(my) }] },
    },
    {
      from: 'cov',
      to: 'eigen',
      title: 'Measure how features move together',
      caption: 'The covariance matrix records each feature’s spread and how the two vary together. A big off-diagonal number means they are strongly linked.',
      parcel: { name: 'Covariance matrix', fields: [{ k: 'row 1', v: `${fx(a)}   ${fx(b)}` }, { k: 'row 2', v: `${fx(b)}   ${fx(d)}` }] },
      memory: { cov: [{ k: 'link', v: fx(b / Math.sqrt(a * d)) }] },
    },
    {
      from: 'eigen',
      to: 'project',
      title: `Main direction explains ${Math.round(explained * 100)}%`,
      caption: 'The eigenvectors of that matrix are the principal components: the direction of greatest spread, then the next one at a right angle. Their eigenvalues say how much spread each holds.',
      parcel: {
        name: 'Principal components',
        fields: [
          { k: 'PC1 direction', v: `(${fx(v[0])}, ${fx(v[1])})` },
          { k: 'PC1 variance', v: `${fx(l1)} (${Math.round(explained * 100)}%)` },
          { k: 'PC2 variance', v: `${fx(l2)} (${Math.round((1 - explained) * 100)}%)` },
        ],
      },
    },
    {
      from: 'project',
      to: 'project',
      title: '2 numbers become 1',
      caption: `Projecting every point onto PC1 keeps ${Math.round(explained * 100)}% of the variation with half the numbers. Lower the link between features and PCA can compress less. The same idea shrinks images, speeds up models and helps plot high-dimensional data.`,
      parcel: { name: 'Compressed', fields: [{ k: 'dimensions', v: '2 → 1' }, { k: 'information kept', v: `${Math.round(explained * 100)}%` }] },
      memory: { project: [{ k: 'kept', v: `${Math.round(explained * 100)}%` }] },
    },
  ]
}

function details(input: InputValues) {
  const { pts, mx, my, a, b, d, v, proj, explained } = compute(input)
  const line = { x1: mx - v[0] * 8, y1: my - v[1] * 8, x2: mx + v[0] * 8, y2: my + v[1] * 8 }
  const span = Math.max(...proj.map(Math.abs), 1)
  return {
    data: <SdPlot points={pts.map(([x, y]) => ({ x, y, cls: 'c0' }))} w={166} h={104} />,
    center: <SdText text={`means: ${fx(mx, 1)}, ${fx(my, 1)}`} y={12} />,
    cov: (
      <>
        <SdText text={`${fx(a)}   ${fx(b)}`} strong y={12} />
        <SdText text={`${fx(b)}   ${fx(d)}`} strong y={30} />
      </>
    ),
    eigen: <SdBars items={[['PC1', explained], ['PC2', 1 - explained]]} width={126} max={1} highlight="PC1" />,
    project: (
      <>
        <SdPlot points={pts.map(([x, y]) => ({ x, y, cls: 'grey', r: 2 }))} lines={[line]} w={176} h={70} />
        <g transform="translate(0 82)">
          <line x1={0} y1={6} x2={176} y2={6} className="sd-plotline thin" />
          {proj.map((t, i) => (
            <circle key={i} cx={88 + (t / span) * 84} cy={6} r={2.4} className="sd-dot c2" />
          ))}
        </g>
      </>
    ),
  }
}

export const pcaMachine: Machine = {
  id: 'pca',
  era: 'ml',
  year: 1901,
  name: 'PCA',
  oneLiner: 'Principal component analysis: keep the directions that carry most of the information.',
  groups: [
    { label: 'Data', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Find the main directions', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Compress', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'data', name: 'Data', role: 'Points described by two related features.', x: 124, y: 230, w: 190, h: 150, tone: 'blue', icon: 'db' },
    { id: 'center', name: 'Centre', role: 'Subtract each feature’s mean.', x: 350, y: 140, w: 180, h: 66, tone: 'teal', icon: 'gear' },
    { id: 'cov', name: 'Covariance', role: 'How the features vary together.', x: 350, y: 350, w: 180, h: 80, tone: 'purple', icon: 'grid' },
    { id: 'eigen', name: 'Principal components', role: 'Directions of greatest spread, from the covariance matrix.', x: 558, y: 250, w: 150, h: 90, tone: 'orange', icon: 'route' },
    { id: 'project', name: 'Project to 1-D', role: 'Each point becomes a single number along PC1.', x: 771, y: 240, w: 200, h: 140, tone: 'green', icon: 'vector' },
  ],
  wires: [
    ['data', 'center'],
    ['center', 'cov'],
    ['cov', 'eigen'],
    ['eigen', 'project'],
  ],
  inputs: [{ key: 'link', label: 'How linked the features are', kind: 'slider', min: 0, max: 0.98, step: 0.02 }],
  defaults: { link: 0.85 },
  run,
  details,
}
