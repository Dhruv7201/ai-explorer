import type { FlowStep, InputValues, Machine } from '../types'
import { Bars, Vector } from './visuals'
import { SdBars, SdLines, SdText, SdVectors } from './details'
import { fx } from './util'

/**
 * A toy embedding model. Real models learn hundreds of dimensions; here each word maps onto six readable
 * "meaning" axes, and a text's embedding is the average of its words. Synonyms point the same way.
 */
const AXES = ['tech', 'food', 'pets', 'sport', 'money', 'health', 'repair'] as const
const V = (tech: number, food: number, pets: number, sport: number, money: number, health: number, repair = 0) => [tech, food, pets, sport, money, health, repair]
const LEXICON: Record<string, number[]> = {
  laptop: V(1, 0, 0, 0, 0.1, 0), computer: V(1, 0, 0, 0, 0.1, 0), pc: V(1, 0, 0, 0, 0, 0), boot: V(0.6, 0, 0, 0, 0, 0, 0.8), screen: V(0.8, 0, 0, 0, 0, 0),
  battery: V(0.8, 0, 0, 0, 0, 0), charge: V(0.6, 0, 0, 0, 0.2, 0), power: V(0.6, 0, 0, 0, 0, 0, 0.4), wifi: V(0.9, 0, 0, 0, 0, 0), phone: V(0.9, 0, 0, 0, 0, 0),
  fix: V(0.3, 0, 0, 0, 0, 0.1, 1), broken: V(0.3, 0, 0, 0, 0, 0.1, 1), troubleshooting: V(0.5, 0, 0, 0, 0, 0, 0.9), slow: V(0.5, 0, 0, 0, 0, 0.1, 0.3), turn: V(0.3, 0, 0, 0, 0, 0, 0.7),
  dinner: V(0, 1, 0, 0, 0, 0.1), recipe: V(0, 1, 0, 0, 0, 0), pasta: V(0, 1, 0, 0, 0, 0), cook: V(0, 1, 0, 0, 0, 0), cooking: V(0, 1, 0, 0, 0, 0), meal: V(0, 1, 0, 0, 0, 0.2),
  quick: V(0.1, 0.3, 0, 0.2, 0, 0), easy: V(0.1, 0.3, 0, 0, 0, 0), vegetables: V(0, 0.8, 0, 0, 0, 0.5), healthy: V(0, 0.4, 0, 0.1, 0, 0.9), eat: V(0, 0.9, 0.1, 0, 0, 0.2), food: V(0, 1, 0.2, 0, 0, 0.1),
  dog: V(0, 0, 1, 0, 0, 0), puppy: V(0, 0, 1, 0, 0, 0), cat: V(0, 0, 1, 0, 0, 0), kitten: V(0, 0, 1, 0, 0, 0), pet: V(0, 0, 1, 0, 0, 0), vet: V(0, 0, 0.8, 0, 0, 0.5), bark: V(0, 0, 0.8, 0, 0, 0), barking: V(0, 0, 0.8, 0, 0, 0), train: V(0.1, 0, 0.4, 0.4, 0, 0), training: V(0.1, 0, 0.3, 0.5, 0, 0.1),
  run: V(0, 0, 0, 0.9, 0, 0.4), running: V(0, 0, 0, 0.9, 0, 0.4), marathon: V(0, 0, 0, 1, 0, 0.3), football: V(0, 0, 0, 1, 0, 0), match: V(0, 0, 0, 0.8, 0, 0), score: V(0, 0, 0, 0.7, 0.1, 0), fitness: V(0, 0, 0, 0.7, 0, 0.7), workout: V(0, 0, 0, 0.8, 0, 0.6),
  money: V(0, 0, 0, 0, 1, 0), save: V(0, 0, 0, 0, 0.8, 0.1), saving: V(0, 0, 0, 0, 0.9, 0), budget: V(0, 0, 0, 0, 1, 0), invest: V(0, 0, 0, 0, 1, 0), investing: V(0, 0, 0, 0, 1, 0), stocks: V(0.1, 0, 0, 0, 1, 0), bank: V(0, 0, 0, 0, 0.9, 0), cheap: V(0, 0.1, 0, 0, 0.7, 0), salary: V(0, 0, 0, 0, 0.9, 0),
  exhausted: V(0, 0, 0, 0.1, 0, 0.9), jogging: V(0, 0, 0, 0.9, 0, 0.5), jog: V(0, 0, 0, 0.9, 0, 0.5), fit: V(0, 0, 0, 0.7, 0, 0.7), noise: V(0.1, 0, 0.4, 0, 0, 0.1),
  sleep: V(0, 0, 0, 0, 0, 1), tired: V(0, 0, 0, 0.1, 0, 0.9), doctor: V(0, 0, 0, 0, 0, 1), headache: V(0, 0, 0, 0, 0, 1), stress: V(0, 0, 0, 0, 0.2, 0.8), sick: V(0, 0, 0.1, 0, 0, 1),
}
const STEM = (w: string) => (LEXICON[w] ? w : LEXICON[w.replace(/(ing|es|s|ed)$/, '')] ? w.replace(/(ing|es|s|ed)$/, '') : w)

function embed(text: string) {
  const words: string[] = text.toLowerCase().match(/[a-z]+/g) ?? []
  const known = words.map(STEM).filter((w) => LEXICON[w])
  const sum = AXES.map((_, i) => known.reduce((s, w) => s + LEXICON[w][i], 0))
  const len = Math.hypot(...sum) || 1
  return { vec: sum.map((v) => v / len), known, words }
}
const cosine = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0)

const DOCS = [
  'Computer will not boot: a troubleshooting guide',
  'Five easy pasta recipes for weeknight dinners',
  'How to stop a puppy barking at night',
  'Beginner marathon training plan',
  'Budgeting basics: saving money each month',
  'Why you feel tired after poor sleep',
  'Phone battery drains fast? Try these settings',
  'Healthy meals with vegetables for busy people',
]
const INDEX = DOCS.map((d) => ({ text: d, ...embed(d) }))

const QUERIES = ['my laptop won’t turn on', 'quick dinner ideas', 'dog keeps making noise', 'how to put money aside', 'always exhausted', 'get fit by jogging']

function compute(input: InputValues) {
  const query = String(input.query ?? QUERIES[0]).trim() || QUERIES[0]
  const k = Number(input.k ?? 3)
  const q = embed(query)
  const ranked = INDEX.map((d) => ({ ...d, score: cosine(q.vec, d.vec), overlap: d.words.filter((w) => q.words.includes(w) && w.length > 2).length })).sort(
    (a, b) => b.score - a.score,
  )
  const byKeyword = [...ranked].sort((a, b) => b.overlap - a.overlap)[0]
  return { query, k, q, ranked, top: ranked.slice(0, k), byKeyword }
}

const short = (s: string, n = 34) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

function run(input: InputValues): FlowStep[] {
  const { query, k, q, ranked, top, byKeyword } = compute(input)
  const best = ranked[0]
  const noMeaning = q.known.length === 0
  return [
    {
      from: 'query',
      to: 'embed',
      title: 'You ask a question',
      caption: 'Keyword search looks for the same words. Semantic search looks for the same meaning, so “laptop won’t turn on” can find “computer will not boot” with no shared words.',
      parcel: { name: 'Query', fields: [{ k: 'text', v: `“${query}”` }, { k: 'words', v: String(q.words.length) }] },
      memory: { query: [{ k: 'query', v: query }] },
    },
    {
      from: 'embed',
      to: 'score',
      title: 'Turn the text into a vector',
      caption: noMeaning
        ? 'This toy embedding model knows none of these words, so the vector is all zeros and nothing can be matched. Try one of the example queries.'
        : `An embedding model maps text to a list of numbers where similar meanings point in similar directions. This toy model has 7 readable dimensions; real ones have 384 to 3,072 that nobody labelled. It recognised: ${q.known.join(', ')}.`,
      parcel: {
        name: 'Query embedding',
        fields: AXES.map((a, i) => ({ k: a, v: fx(q.vec[i]) })),
        visual: <Vector values={q.vec} label="query" />,
      },
      memory: { embed: [{ k: 'dimensions', v: String(AXES.length) }] },
    },
    {
      from: 'docs',
      to: 'index',
      title: 'Documents were embedded ahead of time',
      caption: `All ${DOCS.length} documents went through the same model when they were added, and their vectors sit in a vector index. Searching never re-reads the documents themselves.`,
      parcel: { name: 'Stored vectors', fields: INDEX.slice(0, 4).map((d) => ({ k: short(d.text, 26), v: `[${d.vec.map((v) => v.toFixed(1)).join(', ')}]` })) },
      memory: { docs: [{ k: 'documents', v: String(DOCS.length) }], index: [{ k: 'vectors', v: String(DOCS.length) }] },
    },
    {
      from: 'index',
      to: 'score',
      title: 'Compare directions: cosine similarity',
      caption: 'Similarity is the cosine of the angle between two vectors: 1 means the same direction, 0 means unrelated. Real vector databases use approximate indexes (like HNSW) to skip most comparisons across millions of vectors.',
      parcel: {
        name: 'Similarities',
        fields: ranked.slice(0, 5).map((d) => ({ k: short(d.text, 28), v: fx(d.score) })),
        visual: <Bars items={ranked.slice(0, 5).map((d) => [short(d.text, 18), Math.max(0, d.score)] as [string, number])} max={1} highlight={short(best.text, 18)} />,
      },
      memory: { score: [{ k: 'best', v: fx(best.score) }] },
    },
    {
      from: 'score',
      to: 'results',
      title: `Return the top ${k}`,
      caption: 'The closest documents come back in order. In a RAG system these are pasted into the prompt so the language model can answer from them.',
      parcel: { name: `Top ${k}`, fields: top.map((d, i) => ({ k: `#${i + 1}`, v: d.text, note: `similarity ${fx(d.score)}` })) },
      memory: { results: [{ k: 'top hit', v: short(best.text, 30) }] },
    },
    {
      from: 'results',
      to: 'results',
      title: 'Meaning beats matching words',
      caption:
        byKeyword.overlap === 0
          ? `Not one word of your query appears in “${best.text}”, so keyword search would have found nothing. Matching on meaning found it anyway.`
          : `Keyword search would rank “${byKeyword.text}” first (${byKeyword.overlap} shared word${byKeyword.overlap === 1 ? '' : 's'}). Many real systems combine both: keywords for exact names and codes, vectors for meaning.`,
      parcel: { name: 'Comparison', fields: [{ k: 'by meaning', v: best.text }, { k: 'by keywords', v: byKeyword.overlap ? byKeyword.text : 'no match' }] },
    },
  ]
}

function details(input: InputValues) {
  const { query, q, ranked, top } = compute(input)
  return {
    query: <SdLines text={`“${query}”`} max={26} lines={2} strong y={12} />,
    embed: <SdVectors rows={[{ label: 'query', values: q.vec }]} cell={14} />,
    docs: (
      <>
        {DOCS.slice(0, 4).map((d, i) => (
          <SdText key={i} text={d} max={26} y={12 + i * 15} />
        ))}
      </>
    ),
    index: <SdVectors rows={INDEX.slice(0, 3).map((d, i) => ({ label: `doc ${i + 1}`, values: d.vec }))} cell={9} />,
    score: <SdBars items={ranked.slice(0, 3).map((d) => [d.text.split(' ')[0], Math.max(0, d.score)] as [string, number])} width={156} max={1} format={(v) => fx(v)} />,
    results: (
      <>
        {top.slice(0, 3).map((d, i) => (
          <SdText key={i} text={`${i + 1}. ${d.text}`} max={30} y={12 + i * 15} />
        ))}
      </>
    ),
  }
}

export const semanticMachine: Machine = {
  id: 'vector-search',
  era: 'engineering',
  year: 2019,
  name: 'Embeddings & vector search',
  oneLiner: 'Find text by meaning, not matching words: embeddings, cosine similarity and vector databases.',
  groups: [
    { label: 'At search time', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Compare', x: 250, y: 40, w: 390, h: 412, tone: 'teal' },
    { label: 'Answer', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'query', name: 'Query', role: 'What you are looking for, in your own words.', x: 124, y: 130, w: 190, h: 80, tone: 'blue', icon: 'search' },
    { id: 'embed', name: 'Embedding model', role: 'Turns any text into a vector of numbers that captures its meaning.', x: 124, y: 330, w: 190, h: 76, tone: 'purple', icon: 'brain' },
    { id: 'docs', name: 'Documents', role: 'The texts you can search, embedded once when they were added.', x: 350, y: 130, w: 180, h: 100, tone: 'teal', icon: 'doc' },
    { id: 'index', name: 'Vector index', role: 'Stores every document’s vector for fast nearest-neighbour lookup.', x: 558, y: 130, w: 150, h: 84, tone: 'teal', icon: 'db' },
    { id: 'score', name: 'Cosine similarity', role: 'Scores how closely each document points the same way as the query.', x: 455, y: 340, w: 200, h: 96, tone: 'orange', icon: 'chart' },
    { id: 'results', name: 'Results', role: 'The closest documents, best first.', x: 771, y: 250, w: 200, h: 90, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['query', 'embed'],
    ['embed', 'score'],
    ['docs', 'index'],
    ['index', 'score'],
    ['score', 'results'],
  ],
  inputs: [
    { key: 'query', label: 'Search for', kind: 'select', options: QUERIES },
    { key: 'k', label: 'Results to return (k)', kind: 'slider', min: 1, max: 5 },
  ],
  defaults: { query: QUERIES[0], k: 3 },
  run,
  details,
}
