import type { FlowStep, InputValues, Machine } from '../types'
import { Bars } from './visuals'
import { SdBars, SdChips, SdText } from './details'

/** Shapes of real model families: layers × key/value heads × head size. */
const MODELS: Record<string, { layers: number; kvHeads: number; headDim: number; note: string }> = {
  'Older 7B (every head keeps K and V)': { layers: 32, kvHeads: 32, headDim: 128, note: 'standard multi-head attention' },
  '8B with grouped-query attention': { layers: 32, kvHeads: 8, headDim: 128, note: 'grouped-query attention: 4 query heads share each K/V head' },
  '70B with grouped-query attention': { layers: 80, kvHeads: 8, headDim: 128, note: 'grouped-query attention: 8 query heads share each K/V head' },
}
const WORDS = ['The', 'cache', 'keeps', 'every', 'key', 'and', 'value', 'so', 'old', 'tokens', 'are', 'never', 'redone']

const fmtBytes = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(0)} MB` : `${(b / 1e3).toFixed(0)} KB`)
const fmtN = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(Math.round(n)))

function compute(input: InputValues) {
  const name = (input.model as string) in MODELS ? (input.model as string) : Object.keys(MODELS)[1]
  const m = MODELS[name]
  const prompt = Number(input.prompt ?? 8) * 1000
  const out = Number(input.output ?? 500)
  const users = Number(input.users ?? 1)
  const cache = input.cache !== false
  // Two vectors (K and V) per layer per K/V head, 2 bytes per number at 16-bit.
  const perToken = 2 * m.layers * m.kvHeads * m.headDim * 2
  const total = prompt + out
  const memory = perToken * total * users
  const withCache = prompt + out
  const withoutCache = out * prompt + (out * (out + 1)) / 2
  return { name, m, prompt, out, users, cache, perToken, total, memory, withCache, withoutCache, speedup: withoutCache / withCache }
}

function run(input: InputValues): FlowStep[] {
  const { name, m, prompt, out, users, cache, perToken, total, memory, withCache, withoutCache, speedup } = compute(input)
  const work = cache ? withCache : withoutCache
  return [
    {
      from: 'prompt',
      to: 'prefill',
      title: `A ${fmtN(prompt)}-token prompt arrives`,
      caption: 'A language model writes one token at a time, and every new token has to attend to every token before it. The question is what to do about all that earlier text.',
      parcel: { name: 'Prompt', fields: [{ k: 'tokens', v: fmtN(prompt) }, { k: 'to generate', v: `${out} tokens` }, { k: 'model', v: name }] },
      memory: { prompt: [{ k: 'tokens', v: fmtN(prompt) }] },
    },
    {
      from: 'prefill',
      to: 'cache',
      title: 'Prefill: read the whole prompt once',
      caption: `All prompt tokens go through the model together. In every layer, each token produces a key (what it offers) and a value (what it carries). With the cache on, those are saved: ${fmtBytes(perToken)} per token for this model.`,
      parcel: { name: 'Keys & values', fields: [{ k: 'layers', v: String(m.layers) }, { k: 'K/V heads', v: String(m.kvHeads) }, { k: 'per token', v: fmtBytes(perToken) }, { k: 'design', v: m.note }] },
      memory: { prefill: [{ k: 'tokens', v: fmtN(prompt) }], cache: [{ k: 'size', v: cache ? fmtBytes(perToken * prompt) : 'off' }] },
    },
    {
      from: 'decode',
      to: 'attend',
      title: 'Decode: one new token',
      caption: cache
        ? 'To write the next token, only that one token runs through the model. It makes its own query, key and value, and its key and value are appended to the cache.'
        : 'Without a cache, writing the next token means running the entire text so far through the model again, recomputing keys and values that have not changed.',
      parcel: { name: 'New token', fields: [{ k: 'tokens processed', v: cache ? '1' : fmtN(prompt + 1) }, { k: 'mode', v: cache ? 'cached' : 'recompute all' }] },
    },
    {
      from: 'cache',
      to: 'attend',
      title: 'Attend to everything already cached',
      caption: 'The new token’s query is compared with every stored key to decide what to look at, then blends the matching values. Old tokens are read, never recomputed.',
      parcel: { name: 'Attention', fields: [{ k: 'keys compared', v: fmtN(prompt) }, { k: 'recomputed', v: cache ? '0' : fmtN(prompt) }] },
      memory: { attend: [{ k: 'keys read', v: fmtN(prompt) }] },
    },
    {
      from: 'attend',
      to: 'output',
      title: 'Emit the token and loop',
      caption: `The token is printed and fed back as the next input. This repeats ${out} times. Adding up all ${out} steps, the model computes keys and values for ${fmtN(work)} token positions${cache ? '' : ` (vs ${fmtN(withCache)} with a cache)`}.`,
      parcel: {
        name: 'Work for the whole reply',
        fields: [{ k: 'with cache', v: fmtN(withCache) }, { k: 'without cache', v: fmtN(withoutCache) }, { k: 'saving', v: `${Math.round(speedup)}× less` }],
        visual: <Bars items={[['no cache', withoutCache], ['cache', withCache]]} highlight="cache" />,
      },
      memory: { output: [{ k: 'tokens out', v: String(out) }] },
    },
    {
      from: 'output',
      to: 'decode',
      title: `The price: ${fmtBytes(memory)} of memory`,
      caption: `The cache grows with every token: ${fmtBytes(perToken)} × ${fmtN(total)} tokens${users > 1 ? ` × ${users} users` : ''}. For long chats it can outgrow the model itself, which is why serving systems use grouped-query attention, cache quantization and paged memory (vLLM) to fit more users on a GPU.`,
      parcel: { name: 'Cache size', fields: [{ k: 'per token', v: fmtBytes(perToken) }, { k: 'tokens', v: fmtN(total) }, { k: 'users', v: String(users) }, { k: 'total', v: fmtBytes(memory) }] },
      memory: { cache: [{ k: 'size', v: cache ? fmtBytes(memory) : 'off' }], decode: [{ k: 'steps', v: String(out) }] },
    },
  ]
}

function details(input: InputValues) {
  const { prompt, perToken, memory, cache, withCache, withoutCache, m } = compute(input)
  return {
    prompt: <SdChips items={WORDS.slice(0, 7)} width={166} max={7} />,
    prefill: <SdText text={`${fmtN(prompt)} tokens at once`} strong y={12} />,
    cache: (
      <>
        <SdText text={cache ? fmtBytes(memory) : 'cache off'} strong y={12} />
        <SdText text={`${fmtBytes(perToken)} per token, ${m.layers} layers`} y={30} />
      </>
    ),
    attend: <SdText text={`1 query × ${fmtN(prompt)} keys`} strong y={12} />,
    decode: <SdText text={cache ? '1 token per step' : 'whole text per step'} strong y={12} />,
    output: <SdBars items={[['no cache', withoutCache], ['cache', withCache]]} width={176} format={fmtN} highlight="cache" />,
  }
}

export const kvCacheMachine: Machine = {
  id: 'kv-cache',
  era: 'engineering',
  year: 2017,
  name: 'KV cache',
  oneLiner: 'Why chatbots stream text quickly: keys and values are saved once instead of recomputed for every token.',
  groups: [
    { label: 'Prefill', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Decode loop', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Output', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'prompt', name: 'Prompt', role: 'The text so far: system prompt, chat history and your message.', x: 124, y: 130, w: 190, h: 84, tone: 'blue', icon: 'doc' },
    { id: 'prefill', name: 'Prefill', role: 'Runs the whole prompt through the model in one pass.', x: 124, y: 340, w: 190, h: 66, tone: 'blue', icon: 'layers' },
    { id: 'attend', name: 'Attention', role: 'The new token looks back at all earlier keys and values.', x: 350, y: 130, w: 180, h: 66, tone: 'purple', icon: 'attention' },
    { id: 'cache', name: 'KV cache', role: 'Stored keys and values for every token, in every layer.', x: 350, y: 340, w: 180, h: 84, tone: 'teal', icon: 'db' },
    { id: 'decode', name: 'Next token', role: 'Only the newest token runs through the model.', x: 558, y: 340, w: 150, h: 66, tone: 'orange', icon: 'loop' },
    { id: 'output', name: 'Streamed reply', role: 'Tokens appear one by one; each is fed back in.', x: 771, y: 130, w: 200, h: 96, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['prompt', 'prefill'],
    ['prefill', 'cache'],
    ['cache', 'attend'],
    ['decode', 'attend'],
    ['attend', 'output'],
    { from: 'output', to: 'decode', label: 'feed back' },
  ],
  inputs: [
    { key: 'model', label: 'Model', kind: 'select', options: Object.keys(MODELS) },
    { key: 'prompt', label: 'Prompt length', kind: 'slider', min: 1, max: 128, unit: 'K tokens' },
    { key: 'output', label: 'Reply length', kind: 'slider', min: 50, max: 2000, step: 50, unit: 'tokens' },
    { key: 'users', label: 'Users at once', kind: 'slider', min: 1, max: 32 },
    { key: 'cache', label: 'Use the KV cache', kind: 'toggle' },
  ],
  defaults: { model: '8B with grouped-query attention', prompt: 8, output: 500, users: 1, cache: true },
  run,
  details,
}
