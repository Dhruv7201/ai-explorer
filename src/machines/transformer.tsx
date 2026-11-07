import type { FlowStep, InputValues, Machine } from '../types'
import { Bars, Heat, Vector } from './visuals'
import { SdBars, SdChips, SdHeat, SdText, SdVectors } from './details'
import { fx, hash, rng } from './util'

const D = 6 // toy embedding size (real models: thousands)

/** Toy subword tokenizer: whole common words, long words split into stem + suffix. */
function tokenize(text: string): string[] {
  const words = text.match(/[A-Za-z]+|\d+|[^\sA-Za-z\d]/g) ?? []
  return words.flatMap((w) => {
    if (w.length <= 6 || !/^[A-Za-z]+$/.test(w)) return [w]
    const suf = w.match(/(ing|ed|ly|er|est|tion|ness|s)$/i)?.[0]
    return suf && w.length - suf.length >= 3 ? [w.slice(0, -suf.length), `##${suf}`] : [w.slice(0, 4), `##${w.slice(4)}`]
  })
}
const tokenId = (t: string) => hash(t.toLowerCase()) % 50257
const embed = (t: string, pos: number) => {
  const r = rng(hash(t.toLowerCase()))
  return Array.from({ length: D }, (_, i) => (r() * 2 - 1) * 0.9 + 0.1 * Math.sin(pos / 10 ** (i / D)))
}
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0)
const softmax = (xs: number[], temp = 1) => {
  const m = Math.max(...xs)
  const e = xs.map((x) => Math.exp((x - m) / temp))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / s)
}

const NEXT: Record<string, string[]> = {
  the: ['cat', 'dog', 'end', 'best', 'world'],
  a: ['small', 'new', 'long', 'cat', 'good'],
  cat: ['sat', 'is', 'was', 'ran', 'and'],
  dog: ['barked', 'is', 'was', 'ran', 'and'],
  sat: ['on', 'down', 'still', 'quietly', 'there'],
  on: ['the', 'a', 'top', 'my', 'it'],
  is: ['a', 'the', 'not', 'very', 'going'],
  i: ['am', 'think', 'love', 'have', 'was'],
  you: ['are', 'can', 'will', 'know', 'should'],
  of: ['the', 'a', 'course', 'all', 'my'],
}
const FALLBACK = ['the', 'and', 'of', 'to', 'a']

/** Everything the transformer computes for one input; shared by the flow and the in-box visuals. */
function compute(input: InputValues) {
  const text = String(input.text ?? '').trim() || 'The cat sat on the'
  const temp = Number(input.temperature ?? 0.8)
  const tokens = tokenize(text).slice(-8)
  const vecs = tokens.map((t, i) => embed(t, i))
  const n = tokens.length
  // Causal self-attention: each token attends to itself and earlier tokens only.
  const att = vecs.map((q, i) => {
    const w = softmax(vecs.slice(0, i + 1).map((k) => dot(q, k) / Math.sqrt(D)))
    return Array.from({ length: n }, (_, j) => (j <= i ? w[j] : 0))
  })
  const lastAtt = att[n - 1]
  const mixed = Array.from({ length: D }, (_, d) => vecs.reduce((s, v, j) => s + lastAtt[j] * v[d], 0))
  const refined = mixed.map((v, i) => Math.tanh(v * 1.6 + 0.2 * Math.cos(i)))
  const lastWord = tokens[n - 1].replace(/^##/, '').toLowerCase()
  const cands = NEXT[lastWord] ?? FALLBACK
  const jitter = rng(hash(text))
  const probs = softmax([3.1, 2.4, 1.8, 1.2, 0.7].map((l) => l + (jitter() - 0.5) * 0.4), temp)
  const pick = rng(hash(text + temp))()
  let acc = 0
  const chosen = cands[probs.findIndex((p) => (acc += p) >= pick)] ?? cands[0]
  const earlier = n > 1 ? lastAtt.slice(0, n - 1) : lastAtt
  const strongest = earlier.indexOf(Math.max(...earlier))
  return { text, temp, tokens, vecs, n, att, lastAtt, mixed, refined, cands, probs, chosen, strongest }
}

function run(input: InputValues): FlowStep[] {
  const { text, temp, tokens, vecs, n, att, lastAtt, mixed, refined, cands, probs, chosen, strongest } = compute(input)
  return [
    {
      from: 'text',
      to: 'tokenizer',
      title: 'You type a prompt',
      caption: 'A transformer (2017) is the architecture behind GPT, Claude and Gemini. Its only job: given some text, predict what comes next.',
      parcel: { name: 'Prompt', fields: [{ k: 'text', v: text }, { k: 'characters', v: String(text.length) }] },
      memory: { attention: [{ k: 'layers', v: '1 here; real models 30–120' }], ffn: [{ k: 'size', v: `${D} numbers per token` }] },
    },
    {
      from: 'tokenizer',
      to: 'embed',
      title: `Split into ${n} tokens`,
      caption: 'Text is chopped into tokens: whole words or word pieces. Each token gets an ID from a vocabulary of about 50,000. "##" marks a piece that continues a word.',
      parcel: { name: 'Tokens', fields: tokens.map((t, i) => ({ k: `#${i + 1} ${t}`, v: `id ${tokenId(t)}` })) },
      memory: { tokenizer: [{ k: 'tokens', v: tokens.join(' | ') }] },
    },
    {
      from: 'embed',
      to: 'attention',
      title: 'Each token becomes a vector',
      caption: 'Every token ID looks up a learned vector, plus a small signal for its position in the sentence. From here on, the model only sees numbers.',
      parcel: {
        name: 'Embeddings',
        fields: [{ k: 'vectors', v: `${n} × ${D}` }],
        visual: (
          <div className="v-stack">
            {tokens.slice(-4).map((t, i) => (
              <Vector key={i} label={t.slice(0, 6)} values={vecs[n - Math.min(4, n) + i]} />
            ))}
          </div>
        ),
      },
    },
    {
      from: 'attention',
      to: 'ffn',
      title: 'Every token looks at the others',
      caption: `Self-attention lets each token gather information from earlier tokens, weighted by relevance. The last token, "${tokens[n - 1]}", pays most attention to "${tokens[strongest]}". Tokens cannot look ahead.`,
      parcel: {
        name: 'Attention weights',
        fields: tokens.map((t, j) => ({ k: t, v: fx(lastAtt[j]), note: j === n - 1 ? 'itself' : undefined })),
        visual: <Heat rows={tokens.map((t) => t.slice(0, 5))} cols={tokens.map((t) => t.slice(0, 3))} values={att} />,
      },
      memory: { attention: [{ k: 'strongest link', v: `${tokens[n - 1]} → ${tokens[strongest]}` }] },
    },
    {
      from: 'ffn',
      to: 'predict',
      title: 'Refine, then score every word',
      caption: 'A feed-forward network transforms each token’s blended vector; stacks of attention + feed-forward layers are where knowledge lives. The final vector is then scored against the whole vocabulary.',
      parcel: {
        name: 'Last token vector',
        fields: [{ k: 'after attention', v: mixed.map((v) => fx(v, 1)).join(' ') }, { k: 'after feed-forward', v: refined.map((v) => fx(v, 1)).join(' ') }],
        visual: <Vector label="output" values={refined} />,
      },
    },
    {
      from: 'predict',
      to: 'append',
      title: `Next token: "${chosen}"`,
      caption: `Softmax turns scores into probabilities and one token is sampled. Temperature ${temp} ${temp < 0.5 ? 'makes it nearly always pick the top word' : temp > 1.2 ? 'flattens the odds, so surprising words get picked' : 'keeps some variety'}.`,
      parcel: {
        name: 'Probabilities',
        fields: cands.map((c, i) => ({ k: c, v: `${(probs[i] * 100).toFixed(1)}%` })),
        visual: <Bars items={cands.map((c, i) => [c, probs[i]])} max={1} highlight={chosen} />,
      },
      memory: { predict: [{ k: 'picked', v: chosen }], append: [{ k: 'added', v: chosen }] },
    },
    {
      from: 'append',
      to: 'text',
      title: 'Append and repeat',
      caption: 'The new token is added to the prompt and the whole machine runs again for the next one. A long answer is just this loop repeated hundreds of times, one token at a time.',
      parcel: { name: 'New prompt', fields: [{ k: 'text', v: `${text} ${chosen}` }, { k: 'tokens so far', v: String(n + 1) }] },
    },
  ]
}

function details(input: InputValues) {
  const { text, tokens, vecs, n, att, refined, cands, probs, chosen } = compute(input)
  const tail = tokens.slice(-4)
  return {
    text: <SdText text={`“${text}”`} max={38} strong />,
    tokenizer: <SdChips items={tokens} width={236} />,
    embed: <SdVectors rows={tail.map((t, i) => ({ label: t, values: vecs[n - tail.length + i] }))} />,
    attention: <SdHeat labels={tokens} values={att} maxH={108} />,
    ffn: <SdVectors rows={[{ label: 'output', values: refined }]} cell={22} />,
    predict: <SdBars items={cands.map((c, i) => [c, probs[i]] as [string, number])} width={176} max={1} highlight={chosen} />,
    append: <SdText text={`+ “${chosen}”`} strong />,
  }
}

export const transformerMachine: Machine = {
  id: 'transformer',
  era: 'transformers',
  year: 2017,
  name: 'Transformer',
  oneLiner: 'Tokens, embeddings and attention: how a language model predicts the next word.',
  groups: [
    { label: 'Text to numbers', x: 14, y: 72, w: 300, h: 380, tone: 'blue' },
    { label: 'Transformer block', x: 330, y: 72, w: 300, h: 380, tone: 'purple' },
    { label: 'Pick the next token', x: 646, y: 72, w: 240, h: 380, tone: 'orange' },
  ],
  stations: [
    { id: 'text', name: 'Prompt', role: 'The text so far.', x: 164, y: 128, w: 260, h: 58, tone: 'blue', icon: 'doc' },
    { id: 'tokenizer', name: 'Tokenizer', role: 'Splits text into tokens and looks up their IDs.', x: 164, y: 232, w: 260, h: 84, tone: 'blue', icon: 'tokens' },
    { id: 'embed', name: 'Embeddings + position', role: 'Turns each token ID into a vector of numbers.', x: 164, y: 350, w: 260, h: 96, tone: 'teal', icon: 'vector' },
    { id: 'attention', name: 'Self-attention', role: 'Lets each token gather context from the tokens before it.', x: 474, y: 190, w: 244, h: 150, tone: 'purple', icon: 'attention', stack: '× N layers' },
    { id: 'ffn', name: 'Feed-forward', role: 'Transforms each token’s vector; stores much of the model’s knowledge.', x: 474, y: 352, w: 244, h: 64, tone: 'purple', icon: 'layers' },
    { id: 'append', name: 'Append token', role: 'Adds the chosen token to the prompt for the next round.', x: 766, y: 128, w: 200, h: 58, tone: 'green', icon: 'loop' },
    { id: 'predict', name: 'Next-token odds', role: 'Scores every vocabulary word and samples one.', x: 766, y: 290, w: 200, h: 170, tone: 'orange', icon: 'chart' },
  ],
  wires: [
    ['text', 'tokenizer'],
    ['tokenizer', 'embed'],
    ['embed', 'attention'],
    ['attention', 'ffn'],
    ['ffn', 'predict'],
    ['predict', 'append'],
    { from: 'append', to: 'text', route: 'above', label: 'append & repeat' },
  ],
  inputs: [
    { key: 'text', label: 'Prompt', kind: 'text', maxLength: 60 },
    { key: 'temperature', label: 'Temperature', kind: 'slider', min: 0.1, max: 2, step: 0.1 },
  ],
  defaults: { text: 'The cat sat on the', temperature: 0.8 },
  run,
  details,
}
