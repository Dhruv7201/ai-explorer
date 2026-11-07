import type { FlowStep, InputValues, Machine } from '../types'
import { Bars } from './visuals'
import { SdBars, SdText } from './details'
import { hash, rng } from './util'

const PROMPTS: Record<string, [string, number][]> = {
  'My favourite food is': [['pizza', 3.2], ['pasta', 2.6], ['sushi', 2.4], ['chocolate', 1.9], ['tacos', 1.6], ['soup', 0.9], ['gravel', -1.5]],
  'The sky is': [['blue', 4.1], ['clear', 2.4], ['grey', 2.1], ['falling', 0.6], ['purple', 0.2], ['loud', -1.2], ['sandwich', -2.5]],
}

const softmax = (xs: number[], temp: number) => {
  const m = Math.max(...xs)
  const e = xs.map((x) => Math.exp((x - m) / temp))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / s)
}

function compute(input: InputValues) {
  const prompt = (input.prompt as string) in PROMPTS ? (input.prompt as string) : Object.keys(PROMPTS)[0]
  const temp = Number(input.temperature ?? 0.8)
  const topK = Number(input.topk ?? 5)
  const topP = Number(input.topp ?? 0.9)
  const cands = PROMPTS[prompt]
  const words = cands.map(([w]) => w)
  const probs = softmax(cands.map(([, l]) => l), temp)
  const order = probs.map((p, i) => [p, i] as const).sort((a, b) => b[0] - a[0])
  const keptK = new Set(order.slice(0, topK).map(([, i]) => i))
  // Top-p: smallest set of most-likely words whose probabilities add up to at least p.
  const keptP = new Set<number>()
  let acc = 0
  for (const [p, i] of order) {
    if (!keptK.has(i)) continue
    keptP.add(i)
    acc += p
    if (acc >= topP) break
  }
  const total = [...keptP].reduce((s, i) => s + probs[i], 0)
  const final = probs.map((p, i) => (keptP.has(i) ? p / total : 0))
  const pick = rng(hash(`${prompt}${temp}${topK}${topP}`))()
  let c = 0
  const chosen = words[final.findIndex((p) => (c += p) >= pick)] ?? words[order[0][1]]
  return { prompt, temp, topK, topP, cands, words, probs, keptK, keptP, final, chosen }
}

function run(input: InputValues): FlowStep[] {
  const { prompt, temp, topK, topP, cands, words, probs, keptK, keptP, final, chosen } = compute(input)
  const bars = (vals: number[]) => words.map((w, i) => [w, vals[i]] as [string, number])
  return [
    {
      from: 'logits',
      to: 'temp',
      title: `“${prompt} …”`,
      caption: 'At every step the model gives each possible next word a raw score called a logit. How you turn those scores into one word changes the model’s personality, without retraining it.',
      parcel: { name: 'Logits', fields: cands.map(([w, l]) => ({ k: w, v: l.toFixed(1) })) },
    },
    {
      from: 'temp',
      to: 'softmax',
      title: `Temperature ${temp}`,
      caption: 'Logits are divided by the temperature. Below 1 sharpens the odds towards the favourite (focused, repetitive); above 1 flattens them (creative, risky).',
      parcel: { name: 'Scaled logits', fields: cands.map(([w, l]) => ({ k: w, v: (l / temp).toFixed(2) })) },
    },
    {
      from: 'softmax',
      to: 'topk',
      title: 'Softmax: scores become probabilities',
      caption: 'Softmax turns the scaled scores into probabilities that add up to 100%.',
      parcel: { name: 'Probabilities', fields: words.map((w, i) => ({ k: w, v: `${(probs[i] * 100).toFixed(1)}%` })), visual: <Bars items={bars(probs)} max={1} /> },
    },
    {
      from: 'topk',
      to: 'topp',
      title: `Top-k: keep the ${topK} most likely`,
      caption: 'Top-k throws away everything except the k most likely words, so silly long-shots like “gravel” can never be picked.',
      parcel: { name: 'After top-k', fields: words.map((w, i) => ({ k: w, v: keptK.has(i) ? 'kept' : 'removed' })) },
    },
    {
      from: 'topp',
      to: 'sample',
      title: `Top-p ${topP}: ${keptP.size} word${keptP.size > 1 ? 's' : ''} left`,
      caption: 'Top-p (nucleus sampling, 2019) keeps the smallest group of words whose probabilities add up to p. When the model is confident that is just one or two words; when unsure, more.',
      parcel: { name: 'Renormalised', fields: words.filter((_, i) => keptP.has(i)).map((w) => ({ k: w, v: `${(final[words.indexOf(w)] * 100).toFixed(1)}%` })), visual: <Bars items={bars(final)} max={1} highlight={chosen} /> },
      memory: { topp: [{ k: 'left', v: String(keptP.size) }] },
    },
    {
      from: 'sample',
      to: 'sample',
      title: `Sampled: “${chosen}”`,
      caption: 'One word is drawn at random using the remaining odds. APIs expose these as temperature, top_k and top_p; set temperature to 0 for the same answer every time.',
      parcel: { name: 'Next word', fields: [{ k: 'chosen', v: chosen }, { k: 'text', v: `${prompt} ${chosen}` }] },
      memory: { sample: [{ k: 'chosen', v: chosen }] },
    },
  ]
}

function details(input: InputValues) {
  const { temp, topK, topP, words, probs, final, chosen } = compute(input)
  const top = probs.map((p, i) => [words[i], p] as [string, number]).sort((a, b) => b[1] - a[1]).slice(0, 4)
  return {
    logits: <SdText text={`${words.length} candidate words`} y={12} />,
    temp: <SdText text={`÷ ${temp}`} strong y={12} />,
    softmax: <SdBars items={top} width={156} max={1} />,
    topk: <SdText text={`keep ${topK} of ${words.length}`} strong y={12} />,
    topp: <SdText text={`keep ${final.filter((p) => p > 0).length} (p = ${topP})`} strong y={12} />,
    sample: <SdText text={`“${chosen}”`} strong y={14} />,
  }
}

export const samplingMachine: Machine = {
  id: 'sampling',
  era: 'engineering',
  year: 2019,
  name: 'Sampling settings',
  oneLiner: 'Temperature, top-k and top-p: the knobs that make a model focused or creative.',
  groups: [
    { label: 'Model output', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Shape the odds', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Pick', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'logits', name: 'Logits', role: 'Raw scores for each possible next word.', x: 124, y: 230, w: 190, h: 70, tone: 'blue', icon: 'chart' },
    { id: 'temp', name: 'Temperature', role: 'Divides the scores: low sharpens, high flattens.', x: 350, y: 110, w: 180, h: 66, tone: 'orange', icon: 'gear' },
    { id: 'softmax', name: 'Softmax', role: 'Turns scores into probabilities.', x: 350, y: 250, w: 180, h: 126, tone: 'teal', icon: 'chart' },
    { id: 'topk', name: 'Top-k', role: 'Keeps only the k most likely words.', x: 558, y: 160, w: 150, h: 66, tone: 'purple', icon: 'rules' },
    { id: 'topp', name: 'Top-p', role: 'Keeps the smallest set of words covering probability p.', x: 558, y: 340, w: 150, h: 66, tone: 'pink', icon: 'rules' },
    { id: 'sample', name: 'Sample', role: 'Draws one word using the remaining odds.', x: 771, y: 250, w: 200, h: 70, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['logits', 'temp'],
    ['temp', 'softmax'],
    ['softmax', 'topk'],
    ['topk', 'topp'],
    ['topp', 'sample'],
  ],
  inputs: [
    { key: 'prompt', label: 'Prompt', kind: 'select', options: Object.keys(PROMPTS) },
    { key: 'temperature', label: 'Temperature', kind: 'slider', min: 0.1, max: 2, step: 0.1 },
    { key: 'topk', label: 'Top-k', kind: 'slider', min: 1, max: 7 },
    { key: 'topp', label: 'Top-p', kind: 'slider', min: 0.1, max: 1, step: 0.05 },
  ],
  defaults: { prompt: 'My favourite food is', temperature: 0.8, topk: 5, topp: 0.9 },
  run,
  details,
}
