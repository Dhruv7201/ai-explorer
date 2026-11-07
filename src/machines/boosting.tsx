import type { FlowStep, InputValues, Machine } from '../types'
import type { PlotLine } from './details'
import { SdBars, SdPlot, SdText } from './details'
import { Bars } from './visuals'
import { fx, rng } from './util'

/** Toy data: house size (x) against price (y), with a bend no straight line can follow. */
const DATA = (() => {
  const r = rng(7)
  return Array.from({ length: 22 }, (_, i) => {
    const x = 0.3 + (i * 9.4) / 21
    const y = 5 + 2.6 * Math.sin(x * 0.85) + x * 0.18 + (r() - 0.5) * 1.3
    return { x, y: Math.max(0.3, Math.min(9.7, y)) }
  })
})()

interface Stump {
  split: number
  left: number
  right: number
}

/** Finds the single split of x that best explains the current residuals (a depth-1 tree). */
function fitStump(res: number[]): Stump {
  let best: Stump & { sse: number } = { split: 5, left: 0, right: 0, sse: Infinity }
  for (let i = 1; i < DATA.length; i++) {
    const split = (DATA[i - 1].x + DATA[i].x) / 2
    const L = res.slice(0, i)
    const R = res.slice(i)
    const lm = L.reduce((s, v) => s + v, 0) / L.length
    const rm = R.reduce((s, v) => s + v, 0) / R.length
    const sse = L.reduce((s, v) => s + (v - lm) ** 2, 0) + R.reduce((s, v) => s + (v - rm) ** 2, 0)
    if (sse < best.sse) best = { split, left: lm, right: rm, sse }
  }
  return best
}

const mse = (pred: number[]) => pred.reduce((s, p, i) => s + (DATA[i].y - p) ** 2, 0) / DATA.length

function compute(input: InputValues) {
  const rounds = Number(input.rounds ?? 20)
  const lr = Number(input.lr ?? 0.3)
  const base = DATA.reduce((s, d) => s + d.y, 0) / DATA.length
  let pred = DATA.map(() => base)
  const stumps: Stump[] = []
  const errors = [mse(pred)]
  for (let t = 0; t < rounds; t++) {
    const res = DATA.map((d, i) => d.y - pred[i])
    const s = fitStump(res)
    stumps.push(s)
    pred = pred.map((p, i) => p + lr * (DATA[i].x < s.split ? s.left : s.right))
    errors.push(mse(pred))
  }
  const predictAt = (x: number, n = stumps.length) => stumps.slice(0, n).reduce((p, s) => p + lr * (x < s.split ? s.left : s.right), base)
  const firstRes = DATA.map((d) => d.y - base)
  return { rounds, lr, base, stumps, errors, pred, predictAt, firstRes }
}

/** Draws a step-shaped prediction curve as plot lines. */
function curve(f: (x: number) => number): PlotLine[] {
  const out: PlotLine[] = []
  let px = 0
  let py = f(0)
  for (let x = 0.1; x <= 10.001; x += 0.1) {
    const y = f(x)
    out.push({ x1: px, y1: py, x2: x, y2: py })
    if (Math.abs(y - py) > 1e-9) out.push({ x1: x, y1: py, x2: x, y2: y })
    px = x
    py = y
  }
  return out
}

const pts = DATA.map((d) => ({ x: d.x, y: d.y, cls: 'c0' }))

function run(input: InputValues): FlowStep[] {
  const { rounds, lr, base, stumps, errors, predictAt, firstRes } = compute(input)
  const s1 = stumps[0]
  const final = errors[errors.length - 1]
  const checkpoints = [0, 1, 2, 5, 10, 20, 30].filter((n) => n <= rounds)
  return [
    {
      from: 'data',
      to: 'base',
      title: 'Start with the dumbest guess',
      caption: `Gradient boosting begins with one number for everyone: the average price, ${fx(base, 1)}. It is wrong for almost every house, and that is fine.`,
      parcel: { name: 'First guess', fields: [{ k: 'prediction', v: fx(base, 2) }, { k: 'error (MSE)', v: fx(errors[0]) }] },
      memory: { data: [{ k: 'houses', v: String(DATA.length) }], base: [{ k: 'guess', v: fx(base, 2) }] },
    },
    {
      from: 'base',
      to: 'residuals',
      title: 'Measure what is left over',
      caption: 'For each house, the residual is the true price minus the current prediction. These leftovers are exactly what the next tree should learn. (For squared error, they are also the negative gradient, which gives the method its name.)',
      parcel: { name: 'Residuals', fields: firstRes.slice(0, 5).map((r, i) => ({ k: `house ${i + 1}`, v: (r >= 0 ? '+' : '') + fx(r) })) },
    },
    {
      from: 'residuals',
      to: 'tree',
      title: 'Fit a tiny tree to the errors',
      caption: `A weak learner, here a one-question tree, finds the single split that best explains the residuals: “is size below ${fx(s1.split, 1)}?” Left side: ${fx(s1.left)}, right side: ${fx(s1.right)}.`,
      parcel: { name: 'Tree 1', fields: [{ k: 'question', v: `size < ${fx(s1.split, 1)}?` }, { k: 'yes →', v: fx(s1.left) }, { k: 'no →', v: fx(s1.right) }] },
      memory: { tree: [{ k: 'split', v: `size < ${fx(s1.split, 1)}` }] },
    },
    {
      from: 'tree',
      to: 'add',
      title: `Add only ${Math.round(lr * 100)}% of it`,
      caption: `The tree’s correction is shrunk by the learning rate (${lr}) before it is added. Small steps need more trees but generalise better: each tree only nudges the model.`,
      parcel: { name: 'Update', fields: [{ k: 'learning rate', v: String(lr) }, { k: 'error before', v: fx(errors[0]) }, { k: 'error after', v: fx(errors[1] ?? errors[0]) }] },
      memory: { add: [{ k: 'trees', v: String(stumps.length) }] },
    },
    {
      from: 'add',
      to: 'residuals',
      title: `Repeat: ${rounds} rounds`,
      caption: 'New residuals are measured against the improved model and another small tree is fitted to them. Each tree fixes some of what all the earlier trees still get wrong.',
      parcel: {
        name: 'Error by round',
        fields: checkpoints.map((n) => ({ k: `after ${n} tree${n === 1 ? '' : 's'}`, v: fx(errors[n]) })),
        visual: <Bars items={checkpoints.map((n) => [`${n}`, errors[n]] as [string, number])} />,
      },
      memory: { residuals: [{ k: 'error now', v: fx(final) }] },
    },
    {
      from: 'add',
      to: 'model',
      title: 'The sum of many weak trees',
      caption: `The final model is the first guess plus every shrunken tree: a staircase that bends with the data. Error fell from ${fx(errors[0])} to ${fx(final)}. Real libraries (XGBoost, LightGBM, CatBoost) use deeper trees and regularisation, and still win most competitions on tables of data.`,
      parcel: { name: 'Model', fields: [{ k: 'trees', v: String(rounds) }, { k: 'final error', v: fx(final) }, { k: 'price at size 5', v: fx(predictAt(5)) }] },
      memory: { model: [{ k: 'error', v: fx(final) }] },
    },
  ]
}

function details(input: InputValues) {
  const { base, stumps, errors, predictAt, rounds } = compute(input)
  const s1 = stumps[0]
  const checkpoints = [0, Math.min(3, rounds), rounds].filter((v, i, a) => a.indexOf(v) === i)
  return {
    data: <SdPlot points={pts} w={166} h={66} />,
    base: <SdPlot points={pts} lines={[{ x1: 0, y1: base, x2: 10, y2: base }]} w={166} h={56} />,
    residuals: <SdBars items={checkpoints.map((n) => [`${n} trees`, errors[n]] as [string, number])} width={156} format={(v) => fx(v)} />,
    tree: s1 ? (
      <>
        <SdText text={`size < ${fx(s1.split, 1)}?`} strong y={12} />
        <SdText text={`yes ${fx(s1.left)}   no ${fx(s1.right)}`} y={30} />
      </>
    ) : null,
    add: <SdText text={`${stumps.length} trees added`} strong y={12} />,
    model: <SdPlot points={pts} lines={curve((x) => predictAt(x))} w={176} h={66} />,
  }
}

export const boostingMachine: Machine = {
  id: 'gradient-boosting',
  era: 'ml',
  year: 2001,
  name: 'Gradient boosting',
  oneLiner: 'Many tiny trees, each fixing the mistakes of the ones before: the idea behind XGBoost.',
  groups: [
    { label: 'Start', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Boosting loop', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Model', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'data', name: 'Training data', role: 'Houses with their size and real price.', x: 124, y: 140, w: 190, h: 112, tone: 'blue', icon: 'db' },
    { id: 'base', name: 'First guess', role: 'The average price, used for every house.', x: 124, y: 340, w: 190, h: 100, tone: 'blue', icon: 'chart' },
    { id: 'residuals', name: 'Residuals', role: 'How wrong the current model is for each house.', x: 350, y: 140, w: 180, h: 100, tone: 'orange', icon: 'vector' },
    { id: 'tree', name: 'Small tree', role: 'A one-question tree fitted to the residuals.', x: 350, y: 340, w: 180, h: 84, tone: 'teal', icon: 'route' },
    { id: 'add', name: 'Shrink & add', role: 'Adds a fraction (the learning rate) of the tree to the model.', x: 558, y: 250, w: 150, h: 76, tone: 'purple', icon: 'loop' },
    { id: 'model', name: 'Boosted model', role: 'The first guess plus every tree: the final predictor.', x: 771, y: 250, w: 200, h: 112, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['data', 'base'],
    ['base', 'residuals'],
    ['residuals', 'tree'],
    ['tree', 'add'],
    { from: 'add', to: 'residuals', label: 'repeat', route: 'above' },
    ['add', 'model'],
  ],
  inputs: [
    { key: 'rounds', label: 'Trees (rounds)', kind: 'slider', min: 1, max: 40 },
    { key: 'lr', label: 'Learning rate', kind: 'slider', min: 0.05, max: 1, step: 0.05 },
  ],
  defaults: { rounds: 20, lr: 0.3 },
  run,
  details,
}
