import type { FlowStep, InputValues, Machine } from '../types'
import { Bars } from './visuals'
import { SdChips, SdText } from './details'
import { fx, rng } from './util'

const MODELS: Record<string, number> = { '8B model': 8e9, '70B model': 70e9, '405B model': 405e9 }
const GROUPS = ['Whole row (one scale)', 'Groups of 4 (per-group scales)']

/** Sixteen real-looking weights: mostly small, with one outlier, as found in trained LLMs. */
const WEIGHTS = (() => {
  const r = rng(3)
  const w = Array.from({ length: 16 }, () => {
    const u = Math.max(1e-6, r())
    const v = r()
    return 0.35 * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  })
  w[11] = 1.9
  return w
})()

function quantize(ws: number[], bits: number) {
  const levels = 2 ** (bits - 1) - 1
  const max = Math.max(...ws.map(Math.abs), 1e-9)
  const scale = max / levels
  const q = ws.map((w) => Math.max(-levels, Math.min(levels, Math.round(w / scale))))
  return { scale, q, back: q.map((v) => v * scale), levels }
}

function compute(input: InputValues) {
  const bits = Number(input.bits ?? 4)
  const model = (input.model as string) in MODELS ? (input.model as string) : Object.keys(MODELS)[0]
  const grouped = input.groups === GROUPS[1]
  const size = 4
  const parts = grouped ? Array.from({ length: WEIGHTS.length / size }, (_, i) => quantize(WEIGHTS.slice(i * size, i * size + size), bits)) : [quantize(WEIGHTS, bits)]
  const q = parts.flatMap((p) => p.q)
  const back = parts.flatMap((p) => p.back)
  const scales = parts.map((p) => p.scale)
  const err = Math.sqrt(WEIGHTS.reduce((s, w, i) => s + (w - back[i]) ** 2, 0) / WEIGHTS.length)
  const zeros = q.filter((v) => v === 0).length
  const params = MODELS[model]
  // Real group sizes are 32–128 weights, so per-group scales add ~0.25 bits per weight (a 16-bit scale per 64 weights).
  const bitsPerWeight = bits + (grouped ? 16 / 64 : 0)
  const gb = (b: number) => (params * b) / 8 / 1e9
  return { bits, model, grouped, q, back, scales, err, zeros, params, bitsPerWeight, gb, levels: parts[0].levels }
}

const gbText = (g: number) => (g >= 100 ? `${Math.round(g)} GB` : `${g.toFixed(1)} GB`)
function fits(g: number) {
  if (g <= 24) return 'one gaming GPU (24 GB)'
  if (g <= 80) return 'one data-centre GPU (80 GB)'
  return `${Math.ceil(g / 80)} data-centre GPUs`
}

function run(input: InputValues): FlowStep[] {
  const { bits, model, grouped, q, back, scales, err, zeros, bitsPerWeight, gb, levels } = compute(input)
  const full = gb(16)
  const small = gb(bitsPerWeight)
  return [
    {
      from: 'weights',
      to: 'range',
      title: 'A row of 16-bit weights',
      caption: `A trained model is billions of numbers like these, each stored in 16 bits. The ${model} needs ${gbText(full)} just to hold them, before any work is done. Notice the one big outlier: real LLMs have a few of those.`,
      parcel: { name: 'Weights (FP16)', fields: WEIGHTS.slice(0, 6).map((w, i) => ({ k: `w${i + 1}`, v: fx(w, 3) })).concat([{ k: 'w12', v: fx(WEIGHTS[11], 3) }]) },
      memory: { weights: [{ k: 'memory', v: gbText(full) }] },
    },
    {
      from: 'range',
      to: 'round',
      title: `Fit the range onto ${2 * levels + 1} integer steps`,
      caption: grouped
        ? `With ${bits} bits there are only ${2 * levels + 1} levels (−${levels} to +${levels}). Each group of weights gets its own scale, so the outlier only stretches the scale of its own group.`
        : `With ${bits} bits there are only ${2 * levels + 1} levels (−${levels} to +${levels}). One scale is set by the largest weight, so the outlier stretches the grid for everyone.`,
      parcel: { name: 'Scale', fields: scales.map((s, i) => ({ k: grouped ? `group ${i + 1}` : 'whole row', v: fx(s, 4) })).concat([{ k: 'levels', v: String(2 * levels + 1) }]) },
      memory: { range: [{ k: 'scales', v: String(scales.length) }] },
    },
    {
      from: 'round',
      to: 'store',
      title: 'Round every weight to the nearest step',
      caption: `Each weight becomes a small integer: round(weight ÷ scale). ${zeros} of the 16 weights rounded to 0, losing their information completely.${!grouped && bits <= 4 ? ' Switch to per-group scales and watch that number drop.' : ''}`,
      parcel: { name: `INT${bits} weights`, fields: q.slice(0, 8).map((v, i) => ({ k: `w${i + 1}`, v: String(v) })) },
      memory: { round: [{ k: 'rounded to 0', v: `${zeros} of 16` }] },
    },
    {
      from: 'store',
      to: 'dequant',
      title: `Store ${bitsPerWeight === bits ? bits : bitsPerWeight.toFixed(2)} bits per weight`,
      caption: `Only the integers and the scales are saved. The ${model} shrinks from ${gbText(full)} to ${gbText(small)}, and because generating text is limited by how fast weights can be read from memory, it also runs faster.`,
      parcel: { name: 'Stored', fields: [{ k: 'bits per weight', v: bitsPerWeight.toFixed(2) }, { k: 'before', v: gbText(full) }, { k: 'after', v: gbText(small) }], visual: <Bars items={[['FP16', full], [`INT${bits}`, small]]} highlight={`INT${bits}`} /> },
      memory: { store: [{ k: 'memory', v: gbText(small) }] },
    },
    {
      from: 'dequant',
      to: 'result',
      title: 'Multiply back when the model runs',
      caption: `At run time each integer is multiplied by its scale to get an approximate weight. The typical error per weight here is ${fx(err, 3)}. Methods like GPTQ and AWQ choose the rounding carefully so the model’s answers barely change.`,
      parcel: { name: 'Restored weights', fields: WEIGHTS.slice(0, 6).map((w, i) => ({ k: `w${i + 1}`, v: fx(back[i], 3), note: `was ${fx(w, 3)}` })) },
      memory: { dequant: [{ k: 'error', v: fx(err, 3) }] },
    },
    {
      from: 'result',
      to: 'result',
      title: `${gbText(small)}: fits on ${fits(small)}`,
      caption:
        bits >= 8
          ? '8-bit is close to lossless for most models. Try 4-bit: the usual sweet spot for running models locally.'
          : bits >= 4
            ? '4-bit with per-group scales is the common choice for running open models on a laptop or one GPU, with a small quality loss.'
            : `Below 4 bits quality drops quickly: with ${2 * levels + 1} levels most small weights collapse to zero.`,
      parcel: { name: 'Trade-off', fields: [{ k: 'bits', v: String(bits) }, { k: 'memory', v: gbText(small) }, { k: 'fits on', v: fits(small) }, { k: 'error per weight', v: fx(err, 3) }] },
      memory: { result: [{ k: 'fits on', v: fits(small) }] },
    },
  ]
}

function details(input: InputValues) {
  const { bits, q, scales, err, gb, bitsPerWeight, zeros } = compute(input)
  return {
    weights: <SdChips items={WEIGHTS.slice(0, 8).map((w) => w.toFixed(2))} width={166} max={8} />,
    range: <SdText text={scales.length === 1 ? `scale ${fx(scales[0], 3)}` : `${scales.length} scales`} strong y={12} />,
    round: <SdChips items={q.slice(0, 10).map(String)} width={156} max={10} />,
    store: (
      <>
        <SdText text={`FP16  ${gbText(gb(16))}`} y={12} />
        <SdText text={`INT${bits}  ${gbText(gb(bitsPerWeight))}`} strong y={30} />
      </>
    ),
    dequant: (
      <>
        <SdText text={`error ${fx(err, 3)}`} strong y={12} />
        <SdText text={`${zeros} of 16 became 0`} y={30} />
      </>
    ),
    result: <SdText text={gbText(gb(bitsPerWeight))} strong y={12} />,
  }
}

export const quantizationMachine: Machine = {
  id: 'quantization',
  era: 'engineering',
  year: 2022,
  name: 'Quantization',
  oneLiner: 'Shrink a model by storing its weights in 8 or 4 bits instead of 16, so it fits on smaller hardware.',
  groups: [
    { label: 'Trained model', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Quantize (once)', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Run', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'weights', name: 'FP16 weights', role: 'The model’s weights at full 16-bit precision.', x: 124, y: 230, w: 190, h: 84, tone: 'blue', icon: 'layers' },
    { id: 'range', name: 'Find the scale', role: 'Maps the largest weight onto the largest integer.', x: 350, y: 130, w: 180, h: 66, tone: 'orange', icon: 'gear' },
    { id: 'round', name: 'Round', role: 'Turns each weight into the nearest small integer.', x: 350, y: 340, w: 180, h: 84, tone: 'purple', icon: 'grid' },
    { id: 'store', name: 'Stored model', role: 'Integers plus scales: far fewer bytes.', x: 558, y: 340, w: 150, h: 84, tone: 'teal', icon: 'db' },
    { id: 'dequant', name: 'Dequantize', role: 'Multiplies integers by their scale when the model runs.', x: 771, y: 340, w: 200, h: 84, tone: 'pink', icon: 'tool' },
    { id: 'result', name: 'Memory & quality', role: 'How much memory it needs and how much accuracy was lost.', x: 771, y: 130, w: 200, h: 66, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['weights', 'range'],
    ['range', 'round'],
    ['round', 'store'],
    ['store', 'dequant'],
    ['dequant', 'result'],
  ],
  inputs: [
    { key: 'bits', label: 'Bits per weight', kind: 'slider', min: 2, max: 8 },
    { key: 'groups', label: 'Scales', kind: 'select', options: GROUPS },
    { key: 'model', label: 'Model size', kind: 'select', options: Object.keys(MODELS) },
  ],
  defaults: { bits: 4, groups: GROUPS[0], model: '70B model' },
  run,
  details,
}
