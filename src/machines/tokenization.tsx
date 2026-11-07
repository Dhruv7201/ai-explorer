import type { FlowStep, InputValues, Machine } from '../types'
import { SdChips, SdText } from './details'

/** A tiny training corpus: word → how often it appears. */
const CORPUS: [string, number][] = [
  ['the', 9], ['newest', 6], ['low', 5], ['lower', 3], ['lowest', 3], ['widest', 3], ['new', 4], ['newer', 3],
  ['token', 5], ['tokens', 4], ['learning', 4], ['learner', 2], ['running', 3], ['playing', 3], ['play', 3],
  ['player', 3], ['players', 2], ['cat', 3], ['sat', 2], ['on', 5], ['mat', 2], ['is', 6], ['slower', 2],
]
const MAX_MERGES = 40

type Merge = [string, string]

/** Learns byte-pair merges: repeatedly join the most frequent adjacent pair of symbols. */
function learn(): Merge[] {
  let words = CORPUS.map(([w, n]) => ({ syms: [...w], n }))
  const merges: Merge[] = []
  for (let m = 0; m < MAX_MERGES; m++) {
    const counts = new Map<string, number>()
    for (const { syms, n } of words) for (let i = 0; i < syms.length - 1; i++) {
      const key = `${syms[i]}\u0000${syms[i + 1]}`
      counts.set(key, (counts.get(key) ?? 0) + n)
    }
    let best = ''
    let bestN = 0
    for (const [k, n] of counts) if (n > bestN || (n === bestN && k < best)) [best, bestN] = [k, n]
    if (bestN < 2) break
    const [a, b] = best.split('\u0000') as Merge
    merges.push([a, b])
    words = words.map(({ syms, n }) => ({ syms: join(syms, a, b), n }))
  }
  return merges
}

function join(syms: string[], a: string, b: string) {
  const out: string[] = []
  for (let i = 0; i < syms.length; i++) {
    if (syms[i] === a && syms[i + 1] === b) {
      out.push(a + b)
      i++
    } else out.push(syms[i])
  }
  return out
}

const MERGES = learn()
const ALPHABET = [...new Set(CORPUS.flatMap(([w]) => [...w]))].sort()

/** Token IDs: single letters first, then each merge in the order it was learned. Unknown characters get a byte ID. */
function idOf(tok: string, used: Merge[]) {
  const a = ALPHABET.indexOf(tok)
  if (a >= 0) return 100 + a
  const m = used.findIndex(([x, y]) => x + y === tok)
  if (m >= 0) return 100 + ALPHABET.length + m
  return tok.length === 1 ? tok.charCodeAt(0) % 100 : -1
}

function compute(input: InputValues) {
  const text = String(input.text ?? '').toLowerCase().trim() || 'the newest player'
  const used = MERGES.slice(0, Number(input.merges ?? 24))
  const words = text.split(/\s+/).filter(Boolean)
  const perWord = words.map((w) => used.reduce((syms, [a, b]) => join(syms, a, b), [...w]))
  const chars = words.reduce((s, w) => s + w.length, 0)
  const tokens = perWord.flat()
  const ids = tokens.map((t) => idOf(t, used))
  return { text, used, words, perWord, chars, tokens, ids }
}

const show = (t: string) => `“${t}”`

function run(input: InputValues): FlowStep[] {
  const { text, used, words, perWord, chars, tokens, ids } = compute(input)
  const first = MERGES[0]
  const ratio = chars / Math.max(1, tokens.length)
  const longest = [...new Set(tokens)].sort((a, b) => b.length - a.length)[0] ?? ''
  return [
    {
      from: 'text',
      to: 'split',
      title: 'Text comes in',
      caption: 'A language model cannot read letters. Before anything else, text is chopped into tokens, and each token becomes a number. The chopping rules are learned, not written by hand.',
      parcel: { name: 'Text', fields: [{ k: 'text', v: show(text) }, { k: 'words', v: String(words.length) }, { k: 'characters', v: String(chars) }] },
      memory: { text: [{ k: 'characters', v: String(chars) }] },
    },
    {
      from: 'split',
      to: 'apply',
      title: 'Start from single characters',
      caption: 'Each word is first split into single characters. That always works, even for words never seen before, but it makes sequences long and every letter carries little meaning.',
      parcel: { name: 'Characters', fields: words.slice(0, 4).map((w) => ({ k: w, v: [...w].join(' ') })) },
      memory: { split: [{ k: 'symbols', v: String(chars) }] },
    },
    {
      from: 'corpus',
      to: 'merges',
      title: 'Learn merges from a corpus',
      caption: `Byte-pair encoding (BPE) counts which pair of neighbouring symbols appears most often in the training text and glues it into one new symbol. Here the first winner is "${first[0]}" + "${first[1]}". Then it counts again, and repeats.`,
      parcel: { name: 'Merge rules', fields: MERGES.slice(0, 6).map(([a, b], i) => ({ k: `#${i + 1}`, v: `${a} + ${b} → ${a + b}` })) },
      memory: { corpus: [{ k: 'words', v: String(CORPUS.reduce((s, [, n]) => s + n, 0)) }], merges: [{ k: 'learned', v: String(MERGES.length) }] },
    },
    {
      from: 'merges',
      to: 'apply',
      title: `Apply the first ${used.length} merges, in order`,
      caption: `To tokenize, the same merges are replayed in the order they were learned. Frequent words like "the" collapse into one token; rarer words stay in pieces. Slide the merge count down to 0 to see pure characters.`,
      parcel: { name: 'Tokens per word', fields: perWord.slice(0, 5).map((syms, i) => ({ k: words[i], v: syms.join(' | '), note: `${syms.length} token${syms.length === 1 ? '' : 's'}` })) },
      memory: { apply: [{ k: 'tokens', v: String(tokens.length) }] },
    },
    {
      from: 'apply',
      to: 'ids',
      title: 'Look up each token’s ID',
      caption: 'Every token in the vocabulary has a fixed number. Those numbers, not letters, are what the model receives, and each one is turned into an embedding vector.',
      parcel: { name: 'Token IDs', fields: tokens.slice(0, 8).map((t, i) => ({ k: show(t), v: String(ids[i]) })) },
      memory: { ids: [{ k: 'ids', v: ids.slice(0, 6).join(' ') }] },
    },
    {
      from: 'ids',
      to: 'ids',
      title: `${chars} characters became ${tokens.length} tokens`,
      caption: `That is ${ratio.toFixed(1)} characters per token${longest.length > 1 ? `, with "${longest}" as the longest piece` : ''}. Real tokenizers learn about 50,000 to 200,000 merges from huge corpora, giving roughly 4 characters per English token. It is also why models struggle to count letters: they see "${perWord[0]?.join('|') ?? text}", not individual characters.`,
      parcel: { name: 'Summary', fields: [{ k: 'characters', v: String(chars) }, { k: 'tokens', v: String(tokens.length) }, { k: 'chars per token', v: ratio.toFixed(1) }, { k: 'merges used', v: String(used.length) }] },
    },
  ]
}

function details(input: InputValues) {
  const { text, used, tokens, ids, chars, words } = compute(input)
  return {
    text: (
      <>
        <SdText text={show(text)} strong max={24} y={12} />
        <SdText text={`${words.length} words, ${chars} chars`} y={30} />
      </>
    ),
    split: <SdChips items={[...(words[0] ?? '')]} width={156} max={12} />,
    corpus: (
      <>
        {CORPUS.slice(0, 4).map(([w, n], i) => (
          <SdText key={w} text={`${w} ×${n}`} y={12 + i * 15} />
        ))}
      </>
    ),
    merges: (
      <>
        {MERGES.slice(0, 4).map(([a, b], i) => (
          <SdText key={i} text={`${i + 1}. ${a} + ${b} → ${a + b}`} y={12 + i * 15} />
        ))}
      </>
    ),
    apply: <SdChips items={tokens} width={156} max={10} />,
    ids: (
      <>
        <SdText text={ids.slice(0, 7).join(' ')} strong max={26} y={12} />
        <SdText text={`${tokens.length} tokens, ${used.length} merges`} y={30} />
      </>
    ),
  }
}

export const tokenizationMachine: Machine = {
  id: 'tokenization',
  era: 'transformers',
  year: 2016,
  name: 'Tokenization (BPE)',
  oneLiner: 'How text is chopped into tokens before a language model sees it: byte-pair encoding.',
  groups: [
    { label: 'Your text', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Learned once, from a corpus', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'What the model gets', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'text', name: 'Text', role: 'The words you typed.', x: 124, y: 130, w: 190, h: 84, tone: 'blue', icon: 'doc' },
    { id: 'split', name: 'Characters', role: 'Every word split into single letters: the starting point.', x: 124, y: 330, w: 190, h: 84, tone: 'blue', icon: 'tokens' },
    { id: 'corpus', name: 'Training corpus', role: 'A pile of text used to learn which letter pairs are common.', x: 350, y: 130, w: 180, h: 100, tone: 'teal', icon: 'db' },
    { id: 'merges', name: 'Merge rules', role: 'The ordered list of pair merges BPE learned.', x: 558, y: 130, w: 150, h: 100, tone: 'purple', icon: 'rules' },
    { id: 'apply', name: 'Tokenizer', role: 'Replays the merges on your text to get tokens.', x: 455, y: 330, w: 190, h: 84, tone: 'orange', icon: 'gear' },
    { id: 'ids', name: 'Token IDs', role: 'The numbers the model actually receives.', x: 771, y: 330, w: 200, h: 84, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['text', 'split'],
    ['split', 'apply'],
    ['corpus', 'merges'],
    ['merges', 'apply'],
    ['apply', 'ids'],
  ],
  inputs: [
    { key: 'text', label: 'Text', kind: 'text', maxLength: 48 },
    { key: 'merges', label: 'Merges learned', kind: 'slider', min: 0, max: MERGES.length },
  ],
  defaults: { text: 'the newest player is learning tokens', merges: Math.min(24, MERGES.length) },
  run,
  details,
}
