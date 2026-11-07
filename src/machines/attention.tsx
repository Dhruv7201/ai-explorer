import type { FlowStep, InputValues, Machine } from '../types'
import { Bars } from './visuals'
import { SdBars, SdChips, SdText } from './details'
import { fx } from './util'

// Hand-set 3-number meanings: [is a living thing, is a place, is a filler word].
const MEANING: Record<string, number[]> = {
  animal: [1, 0, 0], street: [0, 1, 0], cat: [1, 0, 0], mouse: [1, 0, 0],
  tired: [0.9, 0, 0], wide: [0, 0.9, 0], hungry: [0.9, 0, 0],
  cross: [0.2, 0.3, 0.2], chased: [0.3, 0, 0.2],
  the: [0, 0, 1], "didn't": [0, 0, 1], because: [0, 0, 1], was: [0, 0, 1], too: [0, 0, 1], it: [0, 0, 0.3],
}
const SENTENCES: Record<string, string> = {
  '…because it was tired': "the animal didn't cross the street because it was tired",
  '…because it was too wide': "the animal didn't cross the street because it was too wide",
  'The cat chased the mouse because it was hungry': 'the cat chased the mouse because it was hungry',
}
const D = 3

const softmax = (xs: number[]) => {
  const m = Math.max(...xs)
  const e = xs.map((x) => Math.exp(x - m))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / s)
}

function compute(input: InputValues) {
  const key = (input.sentence as string) in SENTENCES ? (input.sentence as string) : Object.keys(SENTENCES)[0]
  const scale = input.scale !== false
  const words = SENTENCES[key].split(' ')
  const qi = words.indexOf('it')
  const describing = words.slice(qi + 1).find((w) => ['tired', 'wide', 'hungry'].includes(w)) ?? 'tired'
  // Query of "it": look for the noun that fits the word describing it. Keys: each word's meaning.
  const q = MEANING[describing].map((v) => v * 4)
  const keys = words.map((w) => MEANING[w] ?? [0, 0, 0.5])
  const raw = keys.map((k) => k.reduce((s, v, i) => s + v * q[i], 0))
  const scores = raw.map((r) => (scale ? r / Math.sqrt(D) : r))
  const weights = softmax(scores)
  const out = [0, 1, 2].map((d) => keys.reduce((s, k, j) => s + weights[j] * k[d], 0))
  const top = weights.map((w, i) => [words[i], w] as [string, number]).sort((a, b) => b[1] - a[1])
  // A second head that simply looks at the previous word.
  const head2 = words.map((_, j) => (j === qi - 1 ? 0.9 : 0.1 / (words.length - 1)))
  return { key, scale, words, qi, describing, q, keys, raw, scores, weights, out, top, head2 }
}

function run(input: InputValues): FlowStep[] {
  const { words, qi, describing, q, raw, weights, out, top, scale, head2 } = compute(input)
  const nouns = top.filter(([w]) => ['animal', 'street', 'cat', 'mouse'].includes(w))
  return [
    {
      from: 'tokens',
      to: 'qkv',
      title: 'What does “it” refer to?',
      caption: '“Attention Is All You Need” (2017) introduced self-attention, the heart of every transformer. We follow one word, “it”, as it decides which other words matter.',
      parcel: { name: 'Sentence', fields: [{ k: 'tokens', v: String(words.length) }, { k: 'focus word', v: `“it” (position ${qi + 1})` }] },
    },
    {
      from: 'qkv',
      to: 'scores',
      title: 'Every word makes a query, a key and a value',
      caption: `Three learned matrices turn each word’s vector into a query (what am I looking for?), a key (what do I offer?) and a value (what I pass on). Here “it” is looking for something that can be “${describing}”.`,
      parcel: {
        name: 'Query of “it”',
        fields: [
          { k: 'living thing?', v: fx(q[0]) },
          { k: 'place?', v: fx(q[1]) },
          { k: 'filler word?', v: fx(q[2]) },
        ],
      },
    },
    {
      from: 'scores',
      to: 'softmax',
      title: 'Compare the query with every key',
      caption: 'A dot product measures how well each key matches the query: high when they point the same way.',
      parcel: { name: 'Q · K scores', fields: words.map((w, i) => ({ k: w, v: fx(raw[i]) })).filter((_, i) => i !== qi).slice(0, 10) },
    },
    {
      from: 'softmax',
      to: 'mix',
      title: `Scale and softmax: “${top[0][0]}” wins`,
      caption: `Scores are divided by √d (here √${D}) to keep them from getting too extreme, then softmax turns them into weights that add up to 1. ${scale ? 'Turn scaling off to see the weights get sharper.' : 'Without scaling, the biggest score grabs almost all the weight.'}`,
      parcel: {
        name: 'Attention weights',
        fields: top.slice(0, 5).map(([w, v]) => ({ k: w, v: `${Math.round(v * 100)}%` })),
        visual: <Bars items={words.map((w, i) => [w, weights[i]] as [string, number])} max={1} highlight={top[0][0]} />,
      },
      memory: { softmax: [{ k: 'top word', v: top[0][0] }] },
    },
    {
      from: 'mix',
      to: 'heads',
      title: '“it” absorbs what it attended to',
      caption:
        nouns.length > 1 && Math.abs(nouns[0][1] - nouns[1][1]) < 0.05
          ? `“${nouns[0][0]}” and “${nouns[1][0]}” score the same, so “it” stays ambiguous: both are living things that can be hungry. Real models use more context to break the tie.`
          : `The output for “it” is the weighted average of every word’s value, so it now carries the meaning of “${nouns[0]?.[0] ?? top[0][0]}”. Change the sentence’s last word and the answer flips.`,
      parcel: { name: 'New vector for “it”', fields: [{ k: 'living thing', v: fx(out[0]) }, { k: 'place', v: fx(out[1]) }, { k: 'filler', v: fx(out[2]) }] },
    },
    {
      from: 'heads',
      to: 'heads',
      title: 'Many heads look for different things',
      caption: `Multi-head attention runs several of these in parallel, each with its own matrices. Here head 1 resolves what “it” means while head 2 just looks at the previous word, “${words[qi - 1]}”. The original transformer used 8 heads; large models use dozens, in every layer.`,
      parcel: {
        name: 'Two heads',
        fields: [
          { k: 'head 1 looks at', v: top[0][0] },
          { k: 'head 2 looks at', v: words[qi - 1] },
          { k: 'formula', v: 'softmax(Q·Kᵀ / √d) · V' },
        ],
        visual: <Bars items={words.map((w, i) => [w, head2[i]] as [string, number])} max={1} highlight={words[qi - 1]} />,
      },
    },
  ]
}

function details(input: InputValues) {
  const { words, describing, weights, top, qi } = compute(input)
  const shown = words.map((w, i) => [w, weights[i]] as [string, number]).filter((_, i) => i !== qi)
  const best = [...shown].sort((a, b) => b[1] - a[1]).slice(0, 4)
  return {
    tokens: <SdChips items={words} width={166} max={12} />,
    qkv: (
      <>
        <SdText text="Q = what I look for" y={12} />
        <SdText text="K = what I offer" y={27} />
        <SdText text="V = what I pass on" y={42} />
      </>
    ),
    scores: <SdText text={`“it” vs ${words.length - 1} words`} y={12} />,
    softmax: <SdBars items={best} width={126} max={1} highlight={top[0][0]} />,
    mix: <SdText text={`“it” ≈ ${top[0][0]} (${describing})`} strong y={12} max={26} />,
    heads: (
      <>
        <SdText text={`head 1 → ${top[0][0]}`} y={12} />
        <SdText text={`head 2 → ${words[qi - 1]}`} y={28} />
      </>
    ),
  }
}

export const attentionMachine: Machine = {
  id: 'attention',
  era: 'transformers',
  year: 2017,
  name: 'Attention, step by step',
  oneLiner: '“Attention Is All You Need”: queries, keys, values and multi-head attention.',
  groups: [
    { label: 'Input', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'One attention head', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Many heads', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'tokens', name: 'Tokens', role: 'The sentence, one vector per word.', x: 124, y: 230, w: 190, h: 120, tone: 'blue', icon: 'tokens' },
    { id: 'qkv', name: 'Query, key, value', role: 'Three learned projections of every word.', x: 350, y: 130, w: 180, h: 86, tone: 'teal', icon: 'vector' },
    { id: 'scores', name: 'Q · K scores', role: 'How well each key matches the query.', x: 350, y: 355, w: 180, h: 64, tone: 'purple', icon: 'attention' },
    { id: 'softmax', name: 'Scale + softmax', role: 'Divide by √d, then turn scores into weights that sum to 1.', x: 558, y: 250, w: 150, h: 126, tone: 'orange', icon: 'chart' },
    { id: 'mix', name: 'Weighted sum of V', role: 'The new vector: a blend of the values, by weight.', x: 771, y: 120, w: 200, h: 66, tone: 'pink', icon: 'layers' },
    { id: 'heads', name: 'Multi-head', role: 'Several heads in parallel, each looking for something different.', x: 771, y: 320, w: 200, h: 76, tone: 'green', icon: 'grid', stack: '× 8 heads' },
  ],
  wires: [
    ['tokens', 'qkv'],
    ['qkv', 'scores'],
    ['scores', 'softmax'],
    ['softmax', 'mix'],
    ['mix', 'heads'],
  ],
  inputs: [
    { key: 'sentence', label: 'Sentence', kind: 'select', options: Object.keys(SENTENCES) },
    { key: 'scale', label: 'Divide by √d', kind: 'toggle' },
  ],
  defaults: { sentence: '…because it was tired', scale: true },
  run,
  details,
}
