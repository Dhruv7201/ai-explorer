import type { FlowStep, Machine } from '../types'
import type { InputValues } from '../types'
import { SdBars, SdScatter, SdText } from './details'
import { Dots } from './visuals'
import { fx } from './util'

const POINTS = [
  [5.6, 5.5, 'spam'], [4.5, 5.8, 'spam'], [7, 7, 'spam'], [8, 7.5, 'spam'], [8.5, 9, 'spam'],
  [6.5, 8.5, 'spam'], [9, 6, 'spam'], [7.5, 9.2, 'spam'], [3, 8, 'spam'],
  [4.2, 4.4, 'ham'], [5.9, 3.8, 'ham'], [3.8, 4, 'ham'], [4.3, 3.2, 'ham'], [6.4, 3.6, 'ham'],
  [2, 2, 'ham'], [1.5, 3.5, 'ham'], [3, 1.2, 'ham'], [2.5, 5.5, 'ham'], [7.5, 2, 'ham'],
] as const
const label = (c: string) => (c === 'spam' ? 'spam' : 'not spam')

function run(input: Record<string, unknown>): FlowStep[] {
  const q = { x: Number(input.links ?? 5), y: Number(input.bangs ?? 5) }
  const kk = Number(input.k ?? 3)
  const ranked = POINTS.map(([x, y, cls]) => ({ x, y, cls, d: Math.hypot(x - q.x, y - q.y) })).sort((a, b) => a.d - b.d)
  const near = ranked.slice(0, kk)
  const spam = near.filter((p) => p.cls === 'spam').length
  const winner = spam > kk - spam ? 'spam' : 'ham'
  const dots = (showNear: boolean) => (
    <Dots
      points={ranked.map((p, i) => ({ x: p.x, y: p.y, cls: p.cls, near: showNear && i < kk }))}
      query={q}
      radius={showNear ? near[kk - 1].d : undefined}
    />
  )
  return [
    {
      from: 'email',
      to: 'features',
      title: 'A new email arrives',
      caption: 'Learning algorithms only see numbers. Someone has to decide which numbers describe an email. Here: links and exclamation marks.',
      parcel: { name: 'Email', fields: [{ k: 'subject', v: q.y > 5 ? '"WIN NOW!!!"' : '"Notes from Tuesday"' }, { k: 'label', v: 'unknown' }] },
      memory: { memory: [{ k: 'stored examples', v: String(POINTS.length) }, { k: 'training step', v: 'none: it just remembers' }] },
    },
    {
      from: 'features',
      to: 'ruler',
      title: 'Turn it into a point',
      caption: 'Two features make the email a point on a 2-D plane. Similar emails land near each other.',
      parcel: { name: 'Feature vector', fields: [{ k: 'links', v: String(q.x) }, { k: 'exclamation marks', v: String(q.y) }], visual: dots(false) },
    },
    {
      from: 'memory',
      to: 'ruler',
      title: 'Measure against every example',
      caption: 'k-NN has no model at all. It measures the straight-line distance from the new point to every stored example.',
      parcel: {
        name: 'Closest examples',
        fields: ranked.slice(0, 5).map((p, i) => ({ k: `#${i + 1}`, v: `${fx(p.d)} away`, note: label(p.cls) })),
      },
    },
    {
      from: 'ruler',
      to: 'vote',
      title: `Keep the ${kk} nearest`,
      caption: `Only the k = ${kk} closest examples get a say. Try k = 1 (jumpy, trusts one neighbour) and k = 15 (blurry, ignores local detail).`,
      parcel: { name: `${kk} neighbours`, fields: near.map((p, i) => ({ k: `#${i + 1}`, v: label(p.cls), note: fx(p.d) })), visual: dots(true) },
      memory: { vote: [{ k: 'spam', v: String(spam) }, { k: 'not spam', v: String(kk - spam) }] },
    },
    {
      from: 'vote',
      to: 'label',
      title: `Verdict: ${label(winner)}`,
      caption: `${spam} of ${kk} neighbours are spam, so the majority says ${label(winner)}. Classic machine learning works, but only with hand-picked features. Neural networks will learn features themselves.`,
      parcel: { name: 'Prediction', fields: [{ k: 'label', v: label(winner) }, { k: 'votes', v: `${spam} spam, ${kk - spam} not spam` }] },
      memory: { label: [{ k: 'prediction', v: label(winner) }] },
    },
  ]
}

function details(input: InputValues) {
  const q = { x: Number(input.links ?? 5), y: Number(input.bangs ?? 5) }
  const kk = Number(input.k ?? 3)
  const ranked = POINTS.map(([x, y, cls]) => ({ x, y, cls, d: Math.hypot(x - q.x, y - q.y) })).sort((a, b) => a.d - b.d)
  const near = ranked.slice(0, kk)
  const spam = near.filter((p) => p.cls === 'spam').length
  const winner = spam > kk - spam ? 'spam' : 'not spam'
  return {
    email: (
      <>
        <SdText text={q.y > 5 ? '“WIN NOW!!!”' : '“Notes from Tuesday”'} strong y={12} />
        <SdText text="label: unknown" y={30} />
      </>
    ),
    features: <SdBars items={[['links', q.x], ['“!” marks', q.y]]} width={166} max={10} format={String} />,
    memory: <SdScatter points={ranked.map((p, i) => ({ x: p.x, y: p.y, cls: p.cls, near: i < kk }))} query={q} radius={near[kk - 1].d} size={104} />,
    ruler: <>{near.slice(0, 3).map((p, i) => <SdText key={i} text={`#${i + 1}  ${fx(p.d)} away  ${label(p.cls)}`} y={12 + i * 15} />)}</>,
    vote: <SdBars items={[['spam', spam], ['not spam', kk - spam]]} width={126} max={kk} highlight={winner} format={String} />,
    label: (
      <>
        <SdText text={winner} strong y={14} />
        <SdText text={`${spam} of ${kk} neighbours`} y={32} />
      </>
    ),
  }
}

export const knnMachine: Machine = {
  id: 'nearest-neighbours',
  era: 'ml',
  year: 1967,
  name: 'Nearest neighbours',
  oneLiner: 'Classify something new by looking at the most similar examples you already know.',
  groups: [
    { label: 'New email', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Compare with examples', x: 250, y: 40, w: 390, h: 412, tone: 'teal' },
    { label: 'Decide', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'email', name: 'New email', role: 'An email nobody has labelled yet.', x: 124, y: 140, w: 190, h: 80, tone: 'blue', icon: 'doc' },
    { id: 'features', name: 'Features', role: 'Turns the email into numbers chosen by a human.', x: 124, y: 340, w: 190, h: 96, tone: 'blue', icon: 'vector' },
    { id: 'memory', name: 'Examples', role: 'Every labelled email seen before, stored as points.', x: 350, y: 145, w: 180, h: 150, tone: 'teal', icon: 'db' },
    { id: 'ruler', name: 'Distance', role: 'Measures how far the new point is from each example.', x: 350, y: 355, w: 180, h: 96, tone: 'teal', icon: 'search' },
    { id: 'vote', name: 'Vote', role: 'The k nearest examples vote on the label.', x: 555, y: 250, w: 150, h: 96, tone: 'purple', icon: 'chart' },
    { id: 'label', name: 'Label', role: 'The final prediction.', x: 771, y: 250, w: 200, h: 90, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['email', 'features'],
    ['features', 'ruler'],
    ['memory', 'ruler'],
    ['ruler', 'vote'],
    ['vote', 'label'],
  ],
  inputs: [
    { key: 'links', label: 'Links', kind: 'slider', min: 0, max: 10, step: 0.5 },
    { key: 'bangs', label: 'Exclamation marks', kind: 'slider', min: 0, max: 10, step: 0.5 },
    { key: 'k', label: 'k (neighbours)', kind: 'slider', min: 1, max: 15, step: 2 },
  ],
  defaults: { links: 5, bangs: 5, k: 3 },
  run,
  details,
}
