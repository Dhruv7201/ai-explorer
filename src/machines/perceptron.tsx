import type { FlowStep, Machine } from '../types'
import type { InputValues } from '../types'
import { SdBars, SdText } from './details'
import { fx } from './util'

function run(input: Record<string, unknown>): FlowStep[] {
  const x1 = Number(input.studied ?? 6)
  const x2 = Number(input.slept ?? 7)
  const w1 = Number(input.w1 ?? 0.6)
  const w2 = Number(input.w2 ?? 0.4)
  const b = Number(input.bias ?? -5)
  const truth = Boolean(input.passed)
  const p1 = x1 * w1
  const p2 = x2 * w2
  const z = p1 + p2 + b
  const out = z > 0
  const err = Number(truth) - Number(out)
  const lr = 0.1
  const nw1 = w1 + lr * err * x1
  const nw2 = w2 + lr * err * x2
  const nb = b + lr * err

  return [
    {
      from: 'inputs',
      to: 'weights',
      title: 'Two numbers come in',
      caption: 'Frank Rosenblatt’s perceptron (1958) was a machine loosely modelled on a brain cell. Our question: will this student pass the exam?',
      parcel: { name: 'Inputs', fields: [{ k: 'x₁ hours studied', v: String(x1) }, { k: 'x₂ hours slept', v: String(x2) }] },
      memory: { weights: [{ k: 'w₁', v: fx(w1) }, { k: 'w₂', v: fx(w2) }, { k: 'bias', v: fx(b) }] },
    },
    {
      from: 'weights',
      to: 'sum',
      title: 'Multiply by the weights',
      caption: 'Each input is multiplied by its weight: how much that input matters. Weights are the knobs that learning will turn.',
      parcel: { name: 'Weighted inputs', fields: [{ k: 'x₁ × w₁', v: `${x1} × ${fx(w1)} = ${fx(p1)}` }, { k: 'x₂ × w₂', v: `${x2} × ${fx(w2)} = ${fx(p2)}` }] },
    },
    {
      from: 'sum',
      to: 'step',
      title: `Add them up: ${fx(z)}`,
      caption: 'The weighted inputs are summed and the bias is added. The bias shifts how easy it is to say yes.',
      parcel: { name: 'Sum', fields: [{ k: 'Σ + bias', v: `${fx(p1)} + ${fx(p2)} + (${fx(b)}) = ${fx(z)}` }] },
      memory: { sum: [{ k: 'z', v: fx(z) }] },
    },
    {
      from: 'step',
      to: 'output',
      title: out ? 'Fire: pass' : 'Stay quiet: fail',
      caption: 'The activation is a hard threshold: if the sum is above 0 the neuron fires (1), otherwise it outputs 0.',
      parcel: { name: 'Output', fields: [{ k: 'z > 0 ?', v: out ? 'yes' : 'no' }, { k: 'prediction', v: out ? 'pass (1)' : 'fail (0)' }] },
      memory: { output: [{ k: 'prediction', v: out ? 'pass' : 'fail' }] },
    },
    {
      from: 'output',
      to: 'weights',
      title: err === 0 ? 'Correct: no change' : 'Wrong: nudge the weights',
      caption:
        err === 0
          ? 'The prediction matches what really happened, so the weights stay put. Flip "Actually passed" to see a learning update.'
          : `The perceptron learning rule moves each weight by learning-rate × error × input. Repeat over many examples and the line between pass and fail settles into place. (It can only learn straight-line boundaries, a limit that stalled neural nets for years.)`,
      parcel: {
        name: 'Update',
        fields: [
          { k: 'actual', v: truth ? 'pass' : 'fail' },
          { k: 'error', v: String(err) },
          { k: 'new w₁', v: fx(nw1) },
          { k: 'new w₂', v: fx(nw2) },
          { k: 'new bias', v: fx(nb) },
        ],
      },
      memory: { weights: [{ k: 'w₁', v: fx(nw1) }, { k: 'w₂', v: fx(nw2) }, { k: 'bias', v: fx(nb) }] },
    },
  ]
}

function details(input: InputValues) {
  const x1 = Number(input.studied ?? 6)
  const x2 = Number(input.slept ?? 7)
  const w1 = Number(input.w1 ?? 0.6)
  const w2 = Number(input.w2 ?? 0.4)
  const b = Number(input.bias ?? -5)
  const z = x1 * w1 + x2 * w2 + b
  const out = z > 0
  const err = Number(Boolean(input.passed)) - Number(out)
  const zx = 63 + Math.max(-6, Math.min(6, z)) * 10
  return {
    inputs: <SdBars items={[['studied', x1], ['slept', x2]]} width={166} max={10} format={(v) => `${v} h`} />,
    weights: <>{[['w₁', w1], ['w₂', w2], ['bias', b]].map(([k, v], i) => <SdText key={k as string} text={`${k} = ${fx(v as number)}`} y={12 + i * 15} />)}</>,
    sum: <SdText text={`z = ${fx(z)}`} strong y={12} />,
    step: (
      <>
        <path d="M0 40 H63 V6 H126" className="sd-line" />
        <line x1={63} y1={0} x2={63} y2={46} className="sd-cell" />
        <circle cx={zx} cy={out ? 6 : 40} r={4.5} className="sd-query" />
        <SdText text="fires when z > 0" y={60} />
      </>
    ),
    output: (
      <>
        <SdText text={out ? 'pass (1)' : 'fail (0)'} strong y={12} />
        <SdText text={`actual: ${input.passed ? 'pass' : 'fail'}`} y={30} />
        <SdText text={err === 0 ? 'correct' : `error ${err}: update weights`} y={45} />
      </>
    ),
  }
}

export const perceptronMachine: Machine = {
  id: 'perceptron',
  era: 'neural',
  year: 1958,
  name: 'Perceptron',
  oneLiner: 'One artificial neuron: weigh the inputs, add them up, fire if over the line.',
  groups: [
    { label: 'Inputs', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Neuron', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Learn', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'inputs', name: 'Inputs', role: 'The numbers describing one example.', x: 124, y: 230, w: 190, h: 90, tone: 'blue', icon: 'vector' },
    { id: 'weights', name: 'Weights', role: 'How strongly each input counts. These are learned.', x: 350, y: 140, w: 180, h: 96, tone: 'teal', icon: 'gear' },
    { id: 'sum', name: 'Sum', role: 'Adds the weighted inputs and the bias.', x: 350, y: 355, w: 180, h: 66, tone: 'purple', icon: 'chart' },
    { id: 'step', name: 'Threshold', role: 'Outputs 1 if the sum is above zero, else 0.', x: 555, y: 255, w: 150, h: 110, tone: 'orange', icon: 'layers' },
    { id: 'output', name: 'Output', role: 'The neuron’s answer, compared with the truth.', x: 771, y: 240, w: 200, h: 100, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['inputs', 'weights'],
    ['weights', 'sum'],
    ['sum', 'step'],
    ['step', 'output'],
    { from: 'output', to: 'weights', route: 'above', label: 'learning rule' },
  ],
  inputs: [
    { key: 'studied', label: 'Hours studied', kind: 'slider', min: 0, max: 10 },
    { key: 'slept', label: 'Hours slept', kind: 'slider', min: 0, max: 10 },
    { key: 'w1', label: 'Weight w₁', kind: 'slider', min: -1, max: 1, step: 0.1 },
    { key: 'w2', label: 'Weight w₂', kind: 'slider', min: -1, max: 1, step: 0.1 },
    { key: 'bias', label: 'Bias', kind: 'slider', min: -10, max: 5, step: 0.5 },
    { key: 'passed', label: 'Actually passed', kind: 'toggle' },
  ],
  defaults: { studied: 6, slept: 7, w1: 0.6, w2: 0.4, bias: -5, passed: false },
  run,
  details,
}
