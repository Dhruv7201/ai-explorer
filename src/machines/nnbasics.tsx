import type { FlowStep, InputValues, Machine } from '../types'
import { Bars } from './visuals'
import { SdText } from './details'
import { fx, sigmoid } from './util'

// A small network: 3 inputs → 4 → 4 → 2 outputs. Hand-set weights so each neuron has a readable job.
const FEATURES = ['whiskers', 'pointy ears', 'barks']
const OUTPUTS = ['cat', 'dog']
const W1 = [
  [2.0, 0.5, -1.0], // whisker detector
  [0.3, 2.0, -0.5], // ear detector
  [-0.8, -0.3, 2.2], // bark detector
  [1.0, 1.0, -1.0], // "cat-like face"
]
const B1 = [-0.5, -0.5, -0.5, -0.8]
const W2 = [
  [1.5, 1.2, -1.5, 1.0],
  [-1.0, -0.5, 2.0, -0.8],
  [0.6, 0.6, 0.2, 0.4],
  [-0.3, 0.8, 0.5, -0.2],
]
const B2 = [-0.3, -0.3, -0.2, -0.1]
const W3 = [
  [2.0, -1.5, 0.5, 0.3],
  [-1.5, 2.0, 0.2, 0.4],
]
const B3 = [0, 0]
const LAYERS = [W1, W2, W3]

const ACTS: Record<string, { f: (z: number) => number; formula: string; note: string }> = {
  ReLU: { f: (z) => Math.max(0, z), formula: 'max(0, z)', note: 'passes positive values, blocks negatives; the default in modern networks' },
  Sigmoid: { f: sigmoid, formula: '1 / (1 + e^−z)', note: 'squashes any value into 0–1; common in early networks' },
  Tanh: { f: Math.tanh, formula: 'tanh(z)', note: 'squashes into −1…1, centred on zero' },
}

const layerOut = (W: number[][], b: number[], x: number[]) => W.map((row, i) => row.reduce((s, w, j) => s + w * x[j], b[i]))
const softmax = (z: number[]) => {
  const m = Math.max(...z)
  const e = z.map((v) => Math.exp(v - m))
  const s = e.reduce((a, c) => a + c, 0)
  return e.map((v) => v / s)
}

function compute(input: InputValues) {
  const x = [Number(input.whiskers ?? 0.9), Number(input.ears ?? 0.8), Number(input.barks ?? 0.1)]
  const actName = (input.act as string) in ACTS ? (input.act as string) : 'ReLU'
  const act = ACTS[actName]
  const z1 = layerOut(W1, B1, x)
  const a1 = z1.map(act.f)
  const z2 = layerOut(W2, B2, a1)
  const a2 = z2.map(act.f)
  const z3 = layerOut(W3, B3, a2)
  const p = softmax(z3)
  return { x, actName, act, z1, a1, z2, a2, z3, p, best: p[0] >= p[1] ? 0 : 1 }
}

// Drawing geometry (viewBox 900 × 460).
const COLS = [120, 330, 540, 760]
const ys = (n: number) => Array.from({ length: n }, (_, i) => (n === 1 ? 285 : 180 + (i * 220) / (n - 1)))
const SIZES = [3, 4, 4, 2]

function backdrop(input: InputValues, step: number) {
  const { x, a1, a2, p } = compute(input)
  const values = [x, a1, a2, p]
  const lit = step === 0 || step === 1 ? 1 : step === 2 ? 2 : step === 3 ? 3 : 4
  const activeConn = (l: number) => (step === 1 && l === 0) || (step === 3 && l === 1) || (step === 4 && l === 2) || step === 5
  return (
    <>
      {LAYERS.map((W, l) =>
        W.map((row, i) =>
          row.map((w, j) => (
            <line
              key={`${l}-${i}-${j}`}
              x1={COLS[l]}
              y1={ys(SIZES[l])[j]}
              x2={COLS[l + 1]}
              y2={ys(SIZES[l + 1])[i]}
              className={`nn-edge ${w >= 0 ? 'pos' : 'neg'} ${activeConn(l) ? 'is-active' : ''}`}
              style={{ strokeWidth: 0.6 + Math.abs(w) * 1.3 }}
            />
          )),
        ),
      )}
      {SIZES.map((n, l) => {
        const vals = values[l]
        const top = Math.max(...vals.map(Math.abs), 1e-9)
        return ys(n).map((y, i) => {
          const on = l < lit
          const strength = 0.15 + 0.85 * (Math.abs(vals[i]) / top)
          return (
            <g key={`n${l}-${i}`} className={`nn-node ${on ? 'is-on' : ''} ${on && strength < 0.5 ? 'is-dim' : ''}`} transform={`translate(${COLS[l]} ${y})`}>
              <circle r={18} style={{ fillOpacity: on ? strength : 0 }} />
              <text y={4} textAnchor="middle">{on ? fx(vals[i]) : '?'}</text>
              {l === 0 && <text x={-26} y={4} textAnchor="end" className="nn-label">{FEATURES[i]}</text>}
              {l === 3 && <text x={26} y={4} className="nn-label">{on ? `${OUTPUTS[i]} ${Math.round(vals[i] * 100)}%` : OUTPUTS[i]}</text>}
            </g>
          )
        })
      })}
    </>
  )
}

function ActCurve({ f, z }: { f: (z: number) => number; z: number[] }) {
  const pts = Array.from({ length: 41 }, (_, i) => {
    const zz = -4 + (i / 40) * 8
    return `${(i / 40) * 220},${70 - Math.max(-1, Math.min(4, f(zz))) * 14 - 14}`
  }).join(' ')
  return (
    <svg viewBox="-10 -6 240 90" className="v-dots" style={{ width: 240 }}>
      <line x1={0} y1={56} x2={220} y2={56} className="sd-plotline thin" />
      <line x1={110} y1={0} x2={110} y2={80} className="sd-plotline thin" />
      <polyline points={pts} fill="none" className="sd-line" style={{ stroke: 'var(--amber)' }} />
      {z.map((v, i) => (
        <circle key={i} cx={((Math.max(-4, Math.min(4, v)) + 4) / 8) * 220} cy={70 - Math.max(-1, Math.min(4, f(Math.max(-4, Math.min(4, v))))) * 14 - 14} r={4} className="sd-query" />
      ))}
    </svg>
  )
}

function run(input: InputValues): FlowStep[] {
  const { x, actName, act, z1, a1, a2, z3, p, best } = compute(input)
  return [
    {
      from: 'inp',
      to: 'h1',
      title: 'Input layer: numbers go in',
      caption: 'A neural network only understands numbers. Each input neuron holds one feature of the example: here, how strongly a photo shows whiskers, pointy ears or a barking dog (0 = not at all, 1 = definitely).',
      parcel: { name: 'Inputs', fields: FEATURES.map((f, i) => ({ k: f, v: fx(x[i]) })) },
      memory: { inp: [{ k: 'neurons', v: '3 (one per feature)' }] },
    },
    {
      from: 'inp',
      to: 'h1',
      title: 'Weights: every connection has a strength',
      caption: 'Each line is a weight. Thick green lines are strong positive weights (“this input supports me”), red ones are negative (“this input argues against me”). Training a network means finding good values for all these weights.',
      parcel: {
        name: 'Weights into neuron 1',
        fields: [...FEATURES.map((f, i) => ({ k: `from ${f}`, v: fx(W1[0][i]) })), { k: 'bias', v: fx(B1[0]) }],
        visual: <Bars items={FEATURES.map((f, i) => [f, W1[0][i]] as [string, number])} />,
      },
    },
    {
      from: 'h1',
      to: 'h1',
      title: `Hidden layer 1: sum, then ${actName}`,
      caption: `Each hidden neuron multiplies every input by its weight, adds them up with a bias (z = Σ w·x + b), then applies an activation function: ${actName} = ${act.formula}, which ${act.note}. Without activations, stacking layers would collapse into one straight-line model.`,
      parcel: {
        name: 'Hidden layer 1',
        fields: z1.map((z, i) => ({ k: `neuron ${i + 1}`, v: `z = ${fx(z)} → ${fx(a1[i])}` })),
        visual: <ActCurve f={act.f} z={z1} />,
      },
      memory: { h1: [{ k: 'activation', v: actName }] },
    },
    {
      from: 'h1',
      to: 'h2',
      title: 'Hidden layer 2 builds on layer 1',
      caption: 'The second hidden layer does the same thing, but its inputs are the first layer’s outputs. Layer 1 detects simple features (whiskers, ears); layer 2 combines them into bigger ideas (“cat-like face”). Hidden layers are “hidden” because we never see or set their values directly.',
      parcel: { name: 'Hidden layer 2', fields: a2.map((a, i) => ({ k: `neuron ${i + 1}`, v: fx(a) })), visual: <Bars items={a2.map((a, i) => [`neuron ${i + 1}`, a] as [string, number])} /> },
    },
    {
      from: 'h2',
      to: 'out',
      title: `Output layer: ${OUTPUTS[best]} (${Math.round(p[best] * 100)}%)`,
      caption: 'The output layer has one neuron per possible answer. Their raw scores are turned into probabilities with softmax, so they add up to 100%.',
      parcel: {
        name: 'Output',
        fields: OUTPUTS.map((o, i) => ({ k: o, v: `${Math.round(p[i] * 100)}%`, note: `score ${fx(z3[i])}` })),
        visual: <Bars items={OUTPUTS.map((o, i) => [o, p[i]] as [string, number])} max={1} highlight={OUTPUTS[best]} />,
      },
      memory: { out: [{ k: 'prediction', v: OUTPUTS[best] }] },
    },
    {
      from: 'out',
      to: 'out',
      title: 'Deep learning = many hidden layers',
      caption: `This network has ${W1.length * 3 + W2.length * 4 + W3.length * 4} weights and ${B1.length + B2.length + B3.length} biases. A “deep” network stacks many more hidden layers; GPT-scale models have billions of weights. They all start random and are tuned by backpropagation. Try moving the inputs, or switch the activation function.`,
      parcel: {
        name: 'The whole network',
        fields: [
          { k: 'layers', v: 'input 3 → hidden 4 → hidden 4 → output 2' },
          { k: 'weights', v: String(W1.length * 3 + W2.length * 4 + W3.length * 4) },
          { k: 'activation', v: actName },
        ],
      },
    },
  ]
}

function details(input: InputValues) {
  const { actName, p, best } = compute(input)
  return {
    inp: <SdText text="3 neurons: features" y={10} />,
    h1: <SdText text={`4 neurons, ${actName}`} y={10} />,
    h2: <SdText text={`4 neurons, ${actName}`} y={10} />,
    out: <SdText text={`${OUTPUTS[best]} ${Math.round(p[best] * 100)}%`} strong y={10} />,
  }
}

export const nnBasicsMachine: Machine = {
  id: 'neural-network-basics',
  era: 'neural',
  year: 1943,
  name: 'Neural network basics',
  oneLiner: 'Inputs, weights, activations, hidden layers and outputs: how a neural network turns numbers into an answer.',
  groups: [
    { label: 'Input layer', x: 26, y: 40, w: 190, h: 412, tone: 'blue' },
    { label: 'Hidden layers', x: 232, y: 40, w: 420, h: 412, tone: 'purple' },
    { label: 'Output layer', x: 668, y: 40, w: 212, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'inp', name: 'Input layer', role: 'One neuron per input feature; holds the raw numbers.', x: 120, y: 92, w: 170, h: 58, tone: 'blue', icon: 'doc' },
    { id: 'h1', name: 'Hidden layer 1', role: 'Each neuron: weighted sum of inputs + bias, then an activation function.', x: 330, y: 92, w: 170, h: 58, tone: 'purple', icon: 'brain' },
    { id: 'h2', name: 'Hidden layer 2', role: 'Combines layer 1’s outputs into higher-level features.', x: 540, y: 92, w: 170, h: 58, tone: 'purple', icon: 'brain' },
    { id: 'out', name: 'Output layer', role: 'One neuron per answer; softmax turns scores into probabilities.', x: 768, y: 92, w: 180, h: 58, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['inp', 'h1'],
    ['h1', 'h2'],
    ['h2', 'out'],
  ],
  inputs: [
    { key: 'whiskers', label: 'Whiskers', kind: 'slider', min: 0, max: 1, step: 0.1 },
    { key: 'ears', label: 'Pointy ears', kind: 'slider', min: 0, max: 1, step: 0.1 },
    { key: 'barks', label: 'Barks', kind: 'slider', min: 0, max: 1, step: 0.1 },
    { key: 'act', label: 'Activation function', kind: 'select', options: Object.keys(ACTS) },
  ],
  defaults: { whiskers: 0.9, ears: 0.8, barks: 0.1, act: 'ReLU' },
  run,
  details,
  backdrop,
}
