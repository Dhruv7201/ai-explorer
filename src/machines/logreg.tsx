import type { FlowStep, InputValues, Machine } from '../types'
import { SdBars, SdText } from './details'
import { fx, sigmoid } from './util'

// Hours studied → passed (1) or failed (0).
const DATA: [number, number][] = [
  [0.5, 0], [1, 0], [1.5, 0], [2, 0], [2.5, 0], [3, 0], [3.5, 1], [4, 0], [4.5, 1], [5, 0],
  [5.5, 1], [6, 1], [6.5, 1], [7, 1], [8, 1], [9, 1],
]

// Fit w, b once with gradient descent on log loss.
const { W, B } = (() => {
  let w = 0
  let b = 0
  for (let i = 0; i < 4000; i++) {
    let dw = 0
    let db = 0
    for (const [x, y] of DATA) {
      const p = sigmoid(w * x + b)
      dw += (p - y) * x
      db += p - y
    }
    w -= (0.05 * dw) / DATA.length
    b -= (0.05 * db) / DATA.length
  }
  return { W: w, B: b }
})()
const logLoss = DATA.reduce((s, [x, y]) => {
  const p = sigmoid(W * x + B)
  return s - (y * Math.log(p) + (1 - y) * Math.log(1 - p))
}, 0) / DATA.length

function compute(input: InputValues) {
  const hours = Number(input.hours ?? 4)
  const threshold = Number(input.threshold ?? 0.5)
  const z = W * hours + B
  const p = sigmoid(z)
  return { hours, threshold, z, p, pass: p >= threshold }
}

function run(input: InputValues): FlowStep[] {
  const { hours, threshold, z, p, pass } = compute(input)
  return [
    {
      from: 'student',
      to: 'score',
      title: `A student studied ${hours} hours`,
      caption: 'Logistic regression (1958) predicts a yes/no outcome. Despite the name it is a classifier: will this student pass?',
      parcel: { name: 'Features', fields: [{ k: 'hours studied', v: String(hours) }] },
      memory: { score: [{ k: 'learned w', v: fx(W) }, { k: 'learned b', v: fx(B) }], student: [{ k: 'training students', v: String(DATA.length) }] },
    },
    {
      from: 'score',
      to: 'sigmoid',
      title: `Linear score: ${fx(z)}`,
      caption: 'First it computes a straight-line score, exactly like linear regression: z = w × hours + b. The score can be any number, which is not yet a probability.',
      parcel: { name: 'Score', fields: [{ k: 'z = w·x + b', v: `${fx(W)} × ${hours} + (${fx(B)}) = ${fx(z)}` }] },
    },
    {
      from: 'sigmoid',
      to: 'threshold',
      title: `Probability of passing: ${Math.round(p * 100)}%`,
      caption: 'The sigmoid squashes any score into 0–1, giving a probability. The parameters were learned by minimising log loss, which punishes confident wrong answers heavily.',
      parcel: { name: 'Probability', fields: [{ k: 'sigmoid(z)', v: fx(p, 3) }, { k: 'training log loss', v: fx(logLoss, 3) }] },
      memory: { sigmoid: [{ k: 'P(pass)', v: `${Math.round(p * 100)}%` }] },
    },
    {
      from: 'threshold',
      to: 'decision',
      title: pass ? 'Predict: pass' : 'Predict: fail',
      caption: `A threshold turns the probability into a decision. At ${threshold}, ${Math.round(p * 100)}% is ${pass ? 'enough' : 'not enough'}. Raising the threshold makes the model more cautious about saying "pass": fewer false alarms, more misses.`,
      parcel: { name: 'Decision', fields: [{ k: 'threshold', v: String(threshold) }, { k: 'prediction', v: pass ? 'pass' : 'fail' }] },
      memory: { decision: [{ k: 'prediction', v: pass ? 'pass' : 'fail' }] },
    },
  ]
}

function details(input: InputValues) {
  const { hours, threshold, z, p, pass } = compute(input)
  // Sigmoid curve over hours 0..10.
  const pts = Array.from({ length: 41 }, (_, i) => {
    const x = (i / 40) * 10
    return `${(x / 10) * 126},${46 - sigmoid(W * x + B) * 44}`
  }).join(' ')
  return {
    student: <SdText text={`${hours} hours studied`} strong y={12} />,
    score: <SdText text={`z = ${fx(z)}`} strong y={12} />,
    sigmoid: (
      <>
        <polyline points={pts} className="sd-line" fill="none" />
        <line x1={0} y1={46 - threshold * 44} x2={126} y2={46 - threshold * 44} className="sd-plotline thin" />
        <circle cx={(hours / 10) * 126} cy={46 - p * 44} r={4.5} className="sd-query" />
        <SdText text={`P(pass) = ${Math.round(p * 100)}%`} y={62} />
      </>
    ),
    threshold: <SdBars items={[['P(pass)', p], ['threshold', threshold]]} width={126} max={1} highlight="P(pass)" format={(v) => fx(v)} />,
    decision: <SdText text={pass ? 'pass' : 'fail'} strong y={14} />,
  }
}

export const logregMachine: Machine = {
  id: 'logistic-regression',
  era: 'ml',
  year: 1958,
  name: 'Logistic regression',
  oneLiner: 'A straight-line score squashed into a probability: the simplest classifier.',
  groups: [
    { label: 'Input', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Score to probability', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Decide', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'student', name: 'Student', role: 'Described by one feature: hours studied.', x: 124, y: 240, w: 190, h: 70, tone: 'blue', icon: 'user' },
    { id: 'score', name: 'Linear score', role: 'z = w × hours + b, with w and b learned from data.', x: 350, y: 140, w: 180, h: 70, tone: 'teal', icon: 'gear' },
    { id: 'sigmoid', name: 'Sigmoid', role: 'Squashes the score into a probability between 0 and 1.', x: 350, y: 350, w: 180, h: 110, tone: 'purple', icon: 'chart' },
    { id: 'threshold', name: 'Threshold', role: 'Turns a probability into a yes/no decision.', x: 558, y: 250, w: 150, h: 90, tone: 'orange', icon: 'rules' },
    { id: 'decision', name: 'Decision', role: 'Pass or fail.', x: 771, y: 250, w: 200, h: 70, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['student', 'score'],
    ['score', 'sigmoid'],
    ['sigmoid', 'threshold'],
    ['threshold', 'decision'],
  ],
  inputs: [
    { key: 'hours', label: 'Hours studied', kind: 'slider', min: 0, max: 10, step: 0.5 },
    { key: 'threshold', label: 'Decision threshold', kind: 'slider', min: 0.1, max: 0.9, step: 0.05 },
  ],
  defaults: { hours: 4, threshold: 0.5 },
  run,
  details,
}
