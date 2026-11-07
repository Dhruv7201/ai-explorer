import type { FlowStep, Machine } from '../types'
import type { InputValues } from '../types'
import { SdBars, SdText } from './details'
import { fx, sigmoid } from './util'

// A 2-2-1 network learning XOR. "Training progress" blends random starting weights into trained ones.
const START = { h1: [0.2, -0.4, 0.1], h2: [0.5, 0.3, -0.2], y: [0.3, -0.1, 0.05] }
const TRAINED = { h1: [6, 6, -3], h2: [-6, -6, 9], y: [6, 6, -9] }
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t)

function run(input: Record<string, unknown>): FlowStep[] {
  const x1 = input.x1 ? 1 : 0
  const x2 = input.x2 ? 1 : 0
  const t = Number(input.progress ?? 0) / 100
  const W = { h1: mix(START.h1, TRAINED.h1, t), h2: mix(START.h2, TRAINED.h2, t), y: mix(START.y, TRAINED.y, t) }
  const z1 = W.h1[0] * x1 + W.h1[1] * x2 + W.h1[2]
  const z2 = W.h2[0] * x1 + W.h2[1] * x2 + W.h2[2]
  const h1 = sigmoid(z1)
  const h2 = sigmoid(z2)
  const zy = W.y[0] * h1 + W.y[1] * h2 + W.y[2]
  const y = sigmoid(zy)
  const target = x1 ^ x2
  const loss = 0.5 * (y - target) ** 2
  const dy = (y - target) * y * (1 - y)
  const dh1 = dy * W.y[0] * h1 * (1 - h1)
  const dh2 = dy * W.y[1] * h2 * (1 - h2)
  const w = (v: number[]) => `[${v.map((n) => fx(n, 1)).join(', ')}]`

  return [
    {
      from: 'x1',
      to: 'h1',
      title: 'Inputs reach the hidden layer',
      caption: 'XOR ("one or the other, not both") is impossible for a single perceptron. Adding a hidden layer of neurons fixes that.',
      parcel: { name: 'Hidden neuron 1', fields: [{ k: 'inputs', v: `x₁=${x1}, x₂=${x2}` }, { k: 'weighted sum z', v: fx(z1) }, { k: 'sigmoid(z)', v: fx(h1) }] },
      memory: {
        h1: [{ k: 'weights [x₁, x₂, bias]', v: w(W.h1) }, { k: 'output', v: fx(h1) }],
        h2: [{ k: 'weights [x₁, x₂, bias]', v: w(W.h2) }, { k: 'output', v: fx(h2) }],
        y: [{ k: 'weights [h₁, h₂, bias]', v: w(W.y) }, { k: 'output', v: fx(y) }],
      },
    },
    {
      from: 'x2',
      to: 'h2',
      title: 'Each hidden neuron learns its own feature',
      caption: 'Instead of a hard threshold, neurons use a smooth sigmoid curve. Smoothness is what makes calculus, and so learning, possible.',
      parcel: { name: 'Hidden neuron 2', fields: [{ k: 'weighted sum z', v: fx(z2) }, { k: 'sigmoid(z)', v: fx(h2) }] },
    },
    {
      from: 'h1',
      to: 'y',
      title: `Output: ${fx(y)}`,
      caption: 'The output neuron combines the hidden features. This whole left-to-right pass is called the forward pass.',
      parcel: { name: 'Output neuron', fields: [{ k: 'inputs', v: `h₁=${fx(h1)}, h₂=${fx(h2)}` }, { k: 'prediction', v: fx(y) }] },
    },
    {
      from: 'y',
      to: 'loss',
      title: `Error: ${fx(loss, 3)}`,
      caption: `The right answer for ${x1} XOR ${x2} is ${target}. The loss measures how far off the prediction is. Training means making this number small.`,
      parcel: { name: 'Loss', fields: [{ k: 'target', v: String(target) }, { k: 'prediction', v: fx(y) }, { k: 'loss ½(y−t)²', v: fx(loss, 4) }] },
      memory: { loss: [{ k: 'loss', v: fx(loss, 4) }] },
    },
    {
      from: 'loss',
      to: 'y',
      title: 'Backward: blame the output',
      caption: 'Backpropagation (popularised in 1986) runs the chain rule from the loss backwards: how much would the loss change if each number changed a little?',
      parcel: { name: 'Gradient at output', fields: [{ k: '∂loss/∂z_out', v: fx(dy, 4) }, { k: '∂loss/∂w(h₁→y)', v: fx(dy * h1, 4) }, { k: '∂loss/∂w(h₂→y)', v: fx(dy * h2, 4) }] },
    },
    {
      from: 'y',
      to: 'h1',
      title: 'Blame flows to the hidden layer',
      caption: 'Each hidden neuron receives blame in proportion to how much it influenced the output.',
      parcel: { name: 'Hidden gradients', fields: [{ k: 'δ h₁', v: fx(dh1, 4) }, { k: 'δ h₂', v: fx(dh2, 4) }] },
    },
    {
      from: 'h1',
      to: 'x1',
      title: 'Nudge every weight downhill',
      caption: `Each weight moves a small step against its gradient (gradient descent). Drag "Training progress" to watch the network go from guessing to solving XOR. GPT-scale models run this same loop over billions of weights.`,
      parcel: {
        name: 'Weight updates',
        fields: [
          { k: 'learning rate', v: '0.5' },
          { k: 'Δ w(x₁→h₁)', v: fx(-0.5 * dh1 * x1, 4) },
          { k: 'Δ w(x₂→h₂)', v: fx(-0.5 * dh2 * x2, 4) },
          { k: 'Δ w(h₁→y)', v: fx(-0.5 * dy * h1, 4) },
        ],
      },
    },
  ]
}

function details(input: InputValues) {
  const x1 = input.x1 ? 1 : 0
  const x2 = input.x2 ? 1 : 0
  const t = Number(input.progress ?? 0) / 100
  const W = { h1: mix(START.h1, TRAINED.h1, t), h2: mix(START.h2, TRAINED.h2, t), y: mix(START.y, TRAINED.y, t) }
  const h1 = sigmoid(W.h1[0] * x1 + W.h1[1] * x2 + W.h1[2])
  const h2 = sigmoid(W.h2[0] * x1 + W.h2[1] * x2 + W.h2[2])
  const y = sigmoid(W.y[0] * h1 + W.y[1] * h2 + W.y[2])
  const target = x1 ^ x2
  const f = (v: number) => fx(v)
  return {
    x1: <SdText text={`x₁ = ${x1}`} strong y={12} />,
    x2: <SdText text={`x₂ = ${x2}`} strong y={12} />,
    h1: <SdBars items={[['output', h1]]} width={176} max={1} format={f} />,
    h2: <SdBars items={[['output', h2]]} width={176} max={1} format={f} />,
    y: (
      <>
        <SdBars items={[['guess', y]]} width={146} max={1} format={f} highlight="guess" />
        <SdText text={`target ${target}`} y={34} />
      </>
    ),
    loss: (
      <>
        <SdText text={fx(0.5 * (y - target) ** 2, 4)} strong y={12} />
        <SdText text="lower is better" y={30} />
      </>
    ),
  }
}

export const backpropMachine: Machine = {
  id: 'backprop',
  era: 'neural',
  year: 1986,
  name: 'Backpropagation',
  oneLiner: 'Layers of neurons that learn by sending the error backwards and nudging every weight.',
  groups: [
    { label: 'Inputs', x: 14, y: 40, w: 200, h: 412, tone: 'blue' },
    { label: 'Hidden layer', x: 230, y: 40, w: 250, h: 412, tone: 'purple' },
    { label: 'Output & loss', x: 496, y: 40, w: 390, h: 412, tone: 'orange' },
  ],
  stations: [
    { id: 'x1', name: 'Input x₁', role: 'First input bit.', x: 114, y: 130, w: 160, h: 66, tone: 'blue', icon: 'doc' },
    { id: 'x2', name: 'Input x₂', role: 'Second input bit.', x: 114, y: 350, w: 160, h: 66, tone: 'blue', icon: 'doc' },
    { id: 'h1', name: 'Hidden h₁', role: 'A learned feature, roughly “at least one is on”.', x: 355, y: 130, w: 200, h: 70, tone: 'purple', icon: 'brain' },
    { id: 'h2', name: 'Hidden h₂', role: 'A learned feature, roughly “not both are on”.', x: 355, y: 350, w: 200, h: 70, tone: 'purple', icon: 'brain' },
    { id: 'y', name: 'Output', role: 'Combines hidden features into the answer.', x: 600, y: 240, w: 170, h: 90, tone: 'orange', icon: 'brain' },
    { id: 'loss', name: 'Loss', role: 'How wrong the answer is.', x: 795, y: 240, w: 160, h: 84, tone: 'pink', icon: 'chart' },
  ],
  wires: [
    ['x1', 'h1'],
    ['x1', 'h2'],
    ['x2', 'h1'],
    ['x2', 'h2'],
    ['h1', 'y'],
    ['h2', 'y'],
    ['y', 'loss'],
  ],
  inputs: [
    { key: 'x1', label: 'x₁ on', kind: 'toggle' },
    { key: 'x2', label: 'x₂ on', kind: 'toggle' },
    { key: 'progress', label: 'Training progress', kind: 'slider', min: 0, max: 100, step: 5, unit: '%' },
  ],
  defaults: { x1: true, x2: false, progress: 30 },
  run,
  details,
}
