import type { FlowStep, InputValues, Machine } from '../types'
import { Bars } from './visuals'
import { SdBars, SdPlot, SdText } from './details'
import { fx } from './util'

// House size (×100 m²) → price (×$100k). Roughly price = 1.2 × size + 1.5, plus fixed noise.
const DATA: [number, number][] = [
  [1, 2.9], [2, 3.6], [3, 5.6], [4, 6.1], [5, 7.9], [6, 8.4], [7, 10.3], [8, 11.0],
]
const n = DATA.length

const mse = (w: number, b: number) => DATA.reduce((s, [x, y]) => s + (w * x + b - y) ** 2, 0) / n

function train(lr: number, steps: number) {
  let w = 0
  let b = 0
  const history: number[] = [mse(w, b)]
  let last = { dw: 0, db: 0 }
  for (let i = 0; i < steps; i++) {
    const dw = (2 / n) * DATA.reduce((s, [x, y]) => s + (w * x + b - y) * x, 0)
    const db = (2 / n) * DATA.reduce((s, [x, y]) => s + (w * x + b - y), 0)
    w -= lr * dw
    b -= lr * db
    last = { dw, db }
    history.push(mse(w, b))
    if (!Number.isFinite(w) || Math.abs(w) > 1e6) break
  }
  return { w, b, loss: mse(w, b), history, last, diverged: !Number.isFinite(mse(w, b)) || mse(w, b) > history[0] * 10 }
}

const show = (v: number, d = 2) => (Number.isFinite(v) && Math.abs(v) < 1e5 ? fx(v, d) : 'huge')

function compute(input: InputValues) {
  const lr = Number(input.lr ?? 0.01)
  const steps = Number(input.steps ?? 40)
  const size = Number(input.size ?? 6.5)
  const t = train(lr, steps)
  return { lr, steps, size, ...t, pred: t.w * size + t.b }
}

function run(input: InputValues): FlowStep[] {
  const { lr, steps, size, w, b, loss, history, diverged, pred } = compute(input)
  const first = train(lr, 1)
  const curve = history.filter((_, i) => i % Math.max(1, Math.floor(history.length / 6)) === 0).slice(0, 7)
  return [
    {
      from: 'data',
      to: 'model',
      title: `${n} houses with known prices`,
      caption: 'Regression predicts a number. Here: house price from house size. Linear regression (least squares, around 1805) is the oldest trick in machine learning, and still everywhere.',
      parcel: { name: 'Training data', fields: DATA.slice(0, 5).map(([x, y]) => ({ k: `${x * 100} m²`, v: `$${(y * 100).toFixed(0)}k` })) },
      memory: { model: [{ k: 'w', v: '0.00' }, { k: 'b', v: '0.00' }] },
    },
    {
      from: 'model',
      to: 'loss',
      title: 'Start with a bad guess',
      caption: 'The model is just a line: price = w × size + b. It starts flat (w = 0, b = 0), so every prediction is badly wrong.',
      parcel: { name: 'First predictions', fields: [{ k: 'line', v: 'price = 0 × size + 0' }, { k: 'error (MSE)', v: show(history[0]) }] },
    },
    {
      from: 'loss',
      to: 'gradient',
      title: 'Measure the error, find the slope',
      caption: 'Mean squared error averages the squared gaps between prediction and truth. Its gradient says which way to turn w and b to shrink the error fastest.',
      parcel: { name: 'Gradient', fields: [{ k: '∂error/∂w', v: show(first.last.dw) }, { k: '∂error/∂b', v: show(first.last.db) }] },
    },
    {
      from: 'gradient',
      to: 'model',
      title: diverged ? 'Steps too big: it blows up' : `${steps} small steps downhill`,
      caption: diverged
        ? `With learning rate ${lr} each step overshoots the bottom and the error explodes. Lower the learning rate.`
        : `Each step nudges w and b against the gradient by learning rate × slope (gradient descent). After ${steps} steps the line fits the data. Try 0 steps, or a learning rate of 0.04.`,
      parcel: {
        name: 'Training',
        fields: [{ k: 'w', v: show(w) }, { k: 'b', v: show(b) }, { k: 'error now', v: show(loss) }, { k: 'learning rate', v: String(lr) }],
        visual: <Bars items={curve.map((v, i) => [`step ${i * Math.max(1, Math.floor(history.length / 6))}`, Number.isFinite(v) ? Math.min(v, 60) : 60])} />,
      },
      memory: { model: [{ k: 'w', v: show(w) }, { k: 'b', v: show(b) }], loss: [{ k: 'MSE', v: show(loss) }] },
    },
    {
      from: 'model',
      to: 'predict',
      title: `A ${Math.round(size * 100)} m² house: $${show(pred * 100, 0)}k`,
      caption: 'Once trained, the line predicts prices for houses it has never seen. Logistic regression, neural networks and LLMs all reuse this same loop: predict, measure error, follow the gradient.',
      parcel: { name: 'Prediction', fields: [{ k: 'size', v: `${Math.round(size * 100)} m²` }, { k: 'price', v: `$${show(pred * 100, 0)}k` }] },
      memory: { predict: [{ k: 'price', v: `$${show(pred * 100, 0)}k` }] },
    },
  ]
}

function details(input: InputValues) {
  const { w, b, loss, last, size, pred, steps } = compute(input)
  const ok = Number.isFinite(w) && Math.abs(w) < 100
  return {
    data: (
      <SdPlot
        points={DATA.map(([x, y]) => ({ x, y: y * 0.8, cls: 'c0' }))}
        lines={ok ? [{ x1: 0, y1: b * 0.8, x2: 10, y2: (w * 10 + b) * 0.8 }] : []}
        w={166}
        h={104}
      />
    ),
    model: (
      <>
        <SdText text={`price = ${show(w)}·size + ${show(b)}`} strong y={12} max={30} />
        <SdText text={`after ${steps} steps`} y={30} />
      </>
    ),
    loss: (
      <>
        <SdText text={`MSE ${show(loss)}`} strong y={12} />
        <SdText text="mean of squared gaps" y={30} />
      </>
    ),
    gradient: <SdBars items={[['∂w', Math.abs(last.dw)], ['∂b', Math.abs(last.db)]]} width={126} format={(v) => show(v)} />,
    predict: (
      <>
        <SdText text={`$${show(pred * 100, 0)}k`} strong y={14} />
        <SdText text={`for ${Math.round(size * 100)} m²`} y={32} />
      </>
    ),
  }
}

export const linregMachine: Machine = {
  id: 'linear-regression',
  era: 'ml',
  year: 1805,
  name: 'Linear regression',
  oneLiner: 'Fit a straight line to data by walking downhill on the error: gradient descent.',
  groups: [
    { label: 'Data', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Training loop', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Use it', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'data', name: 'Houses', role: 'Sizes and prices we already know.', x: 124, y: 230, w: 190, h: 150, tone: 'blue', icon: 'db' },
    { id: 'model', name: 'Model: a line', role: 'price = w × size + b. Training finds w and b.', x: 350, y: 140, w: 190, h: 80, tone: 'teal', icon: 'chart' },
    { id: 'loss', name: 'Error (MSE)', role: 'Mean squared error between predictions and true prices.', x: 350, y: 355, w: 190, h: 80, tone: 'pink', icon: 'chart' },
    { id: 'gradient', name: 'Gradient', role: 'Which way to change w and b to lower the error.', x: 558, y: 250, w: 150, h: 90, tone: 'orange', icon: 'route' },
    { id: 'predict', name: 'Prediction', role: 'Price for a house the model has never seen.', x: 771, y: 140, w: 200, h: 80, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['data', 'model'],
    ['model', 'loss'],
    ['loss', 'gradient'],
    { from: 'gradient', to: 'model', label: 'update w, b' },
    ['model', 'predict'],
  ],
  inputs: [
    { key: 'lr', label: 'Learning rate', kind: 'slider', min: 0.001, max: 0.04, step: 0.001 },
    { key: 'steps', label: 'Training steps', kind: 'slider', min: 0, max: 200, step: 5 },
    { key: 'size', label: 'New house size (×100 m²)', kind: 'slider', min: 0.5, max: 10, step: 0.5 },
  ],
  defaults: { lr: 0.01, steps: 40, size: 6.5 },
  run,
  details,
}
