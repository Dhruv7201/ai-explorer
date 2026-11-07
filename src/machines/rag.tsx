import type { FlowStep, Machine } from '../types'
import type { InputValues } from '../types'
import { SdBars, SdChips, SdLines, SdText } from './details'
import { Bars } from './visuals'
import { fx } from './util'

// A fictional product handbook used as the knowledge base.
const DOCS = [
  { id: 'Refunds', text: 'Customers can return a Nimbus robot within 30 days of delivery for a full refund.' },
  { id: 'Battery', text: 'The Nimbus R2 battery lasts about 9 hours and charges fully in 2 hours.' },
  { id: 'Warranty', text: 'Every robot includes a 2-year warranty covering motor and sensor faults.' },
  { id: 'Support', text: 'Live chat support is open 8am to 8pm, Monday to Saturday.' },
  { id: 'Shipping', text: 'Orders ship within 3 business days; express delivery costs $15.' },
  { id: 'Updates', text: 'Software updates install automatically every Tuesday night.' },
]
const SYNONYMS: Record<string, string> = {
  return: 'refund', refunds: 'refund', money: 'refund', back: 'refund', weeks: 'days',
  charge: 'battery', charging: 'battery', lasts: 'battery', last: 'battery', hours: 'battery',
  chat: 'support', help: 'support', open: 'support', contact: 'support',
  cover: 'warranty', covered: 'warranty', covers: 'warranty', broken: 'warranty', damage: 'warranty',
  deliver: 'shipping', delivery: 'shipping', ship: 'shipping', arrive: 'shipping',
  update: 'updates', software: 'updates',
}
const STOP = new Set(['the', 'a', 'an', 'is', 'can', 'i', 'my', 'does', 'how', 'what', 'when', 'of', 'to', 'for', 'in', 'and', 'it', 'get', 'after', 'long', 'do'])
const terms = (s: string) =>
  (s.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => !STOP.has(w)).map((w) => SYNONYMS[w] ?? w)
const cosine = (a: string[], b: string[]) => {
  const A = new Map<string, number>()
  const B = new Map<string, number>()
  a.forEach((w) => A.set(w, (A.get(w) ?? 0) + 1))
  b.forEach((w) => B.set(w, (B.get(w) ?? 0) + 1))
  let d = 0
  A.forEach((v, k) => (d += v * (B.get(k) ?? 0)))
  const n = Math.hypot(...A.values()) * Math.hypot(...B.values())
  return n ? d / n : 0
}

const QUESTIONS: Record<string, { grounded: string; madeUp: string }> = {
  'How long does the battery last?': {
    grounded: 'About 9 hours on a full charge, and it recharges in 2 hours. (Source: Battery)',
    madeUp: 'The battery lasts around 14 hours with typical use.',
  },
  'Can I get a refund after three weeks?': {
    grounded: 'Yes. Three weeks is within the 30-day return window, so you get a full refund. (Source: Refunds)',
    madeUp: 'Refunds are only available within 14 days, so unfortunately not.',
  },
  'When is live chat open?': {
    grounded: 'Live chat runs 8am to 8pm, Monday to Saturday. (Source: Support)',
    madeUp: 'Live chat is available 24/7.',
  },
  'Does the warranty cover water damage?': {
    grounded: 'The handbook only mentions motor and sensor faults, so water damage does not appear to be covered. (Source: Warranty)',
    madeUp: 'Yes, water damage is fully covered for 3 years.',
  },
}

function run(input: Record<string, unknown>): FlowStep[] {
  const q = (input.question as string) in QUESTIONS ? (input.question as string) : Object.keys(QUESTIONS)[0]
  const useRag = input.retrieval !== false
  const qt = terms(q)
  const scored = DOCS.map((d) => ({ ...d, s: cosine(qt, terms(`${d.id} ${d.text}`)) })).sort((a, b) => b.s - a.s)
  const top = scored.slice(0, 2)
  const a = QUESTIONS[q]

  if (!useRag)
    return [
      {
        from: 'question',
        to: 'prompt',
        title: 'Ask the model directly',
        caption: 'Without retrieval, the question goes straight to the model. It has never seen this company’s handbook.',
        parcel: { name: 'Question', fields: [{ k: 'text', v: q }] },
        memory: { vectordb: [{ k: 'documents', v: `${DOCS.length} (not used)` }] },
      },
      {
        from: 'prompt',
        to: 'llm',
        title: 'The prompt has no facts in it',
        caption: 'The model can only draw on what it absorbed in training, which is general knowledge, not your private documents.',
        parcel: { name: 'Prompt', fields: [{ k: 'instructions', v: 'Answer the question.' }, { k: 'question', v: q }, { k: 'context', v: 'none' }] },
      },
      {
        from: 'llm',
        to: 'answer',
        title: 'A confident guess',
        caption: 'The model produces something fluent and plausible, but made up. This is called hallucination. Turn retrieval back on to compare.',
        parcel: { name: 'Answer', fields: [{ k: 'reply', v: a.madeUp }, { k: 'grounded in a source?', v: 'no: invented' }] },
        memory: { answer: [{ k: 'reply', v: a.madeUp }] },
      },
    ]

  return [
    {
      from: 'question',
      to: 'embedder',
      title: 'A question comes in',
      caption: 'Retrieval-augmented generation (RAG, 2020) looks up relevant documents first, then lets the model answer using them.',
      parcel: { name: 'Question', fields: [{ k: 'text', v: q }] },
      memory: { vectordb: [{ k: 'documents', v: String(DOCS.length) }, { k: 'source', v: 'product handbook' }] },
    },
    {
      from: 'embedder',
      to: 'retriever',
      title: 'Turn the question into a search vector',
      caption: 'An embedding model maps text to a vector so that questions and passages with similar meaning end up close together. Ours uses keywords and synonyms to stay readable.',
      parcel: { name: 'Query vector', fields: [{ k: 'key terms', v: qt.join(', ') }] },
    },
    {
      from: 'vectordb',
      to: 'retriever',
      title: 'Score every document',
      caption: 'The vector database compares the query against each stored passage and ranks them by similarity.',
      parcel: {
        name: 'Similarity scores',
        fields: scored.map((d) => ({ k: d.id, v: fx(d.s) })),
        visual: <Bars items={scored.map((d) => [d.id, d.s])} max={1} highlight={top[0].id} />,
      },
    },
    {
      from: 'retriever',
      to: 'prompt',
      title: `Keep the top ${top.length}`,
      caption: 'Only the most relevant passages are kept. Models have limited context, and irrelevant text can distract them.',
      parcel: { name: 'Retrieved passages', fields: top.map((d) => ({ k: d.id, v: d.text, note: `score ${fx(d.s)}` })) },
      memory: { retriever: [{ k: 'best match', v: top[0].id }] },
    },
    {
      from: 'prompt',
      to: 'llm',
      title: 'Build an augmented prompt',
      caption: 'The passages are pasted into the prompt along with an instruction to answer only from them and cite the source.',
      parcel: {
        name: 'Prompt',
        fields: [
          { k: 'instructions', v: 'Answer using only the context. Cite the source.' },
          { k: 'context', v: top.map((d) => `[${d.id}] ${d.text}`).join(' ') },
          { k: 'question', v: q },
        ],
      },
    },
    {
      from: 'llm',
      to: 'answer',
      title: 'A grounded answer',
      caption: 'The answer comes from your documents, with a citation you can check. Switch retrieval off to see what happens without it.',
      parcel: { name: 'Answer', fields: [{ k: 'reply', v: a.grounded }, { k: 'grounded in a source?', v: 'yes' }] },
      memory: { answer: [{ k: 'reply', v: a.grounded }] },
    },
  ]
}

function details(input: InputValues) {
  const q = (input.question as string) in QUESTIONS ? (input.question as string) : Object.keys(QUESTIONS)[0]
  const useRag = input.retrieval !== false
  const qt = terms(q)
  const scored = DOCS.map((d) => ({ ...d, s: cosine(qt, terms(`${d.id} ${d.text}`)) })).sort((a, b) => b.s - a.s)
  const off = <SdText text="skipped: retrieval off" />
  return {
    question: <SdLines text={q} max={24} lines={3} strong />,
    embedder: useRag ? <SdChips items={qt} width={136} /> : off,
    vectordb: (
      <>
        <SdText text={`${DOCS.length} passages`} strong y={12} />
        <SdText text="product handbook" y={30} />
      </>
    ),
    retriever: useRag ? <SdBars items={scored.slice(0, 4).map((d) => [d.id, d.s] as [string, number])} width={176} max={1} highlight={scored[0].id} format={(v) => fx(v)} /> : off,
    prompt: <SdText text={useRag ? 'instructions + 2 passages + question' : 'question only, no context'} y={12} max={34} />,
    llm: <SdText text={useRag ? 'answers from the passages' : 'answers from memory'} y={10} max={34} />,
    answer: <SdLines text={useRag ? QUESTIONS[q].grounded : QUESTIONS[q].madeUp} max={32} lines={4} />,
  }
}

export const ragMachine: Machine = {
  id: 'rag',
  era: 'engineering',
  year: 2020,
  name: 'Retrieval (RAG)',
  oneLiner: 'Look things up first, then answer: how chatbots use your own documents.',
  groups: [
    { label: 'Ask', x: 14, y: 40, w: 200, h: 412, tone: 'blue' },
    { label: 'Retrieve', x: 230, y: 40, w: 380, h: 412, tone: 'teal' },
    { label: 'Generate', x: 626, y: 40, w: 260, h: 412, tone: 'orange' },
  ],
  stations: [
    { id: 'question', name: 'Question', role: 'What the user asks.', x: 114, y: 240, w: 180, h: 110, tone: 'blue', icon: 'doc' },
    { id: 'embedder', name: 'Embedder', role: 'Turns text into a vector for searching.', x: 325, y: 135, w: 160, h: 90, tone: 'teal', icon: 'vector' },
    { id: 'vectordb', name: 'Vector database', role: 'Stores every document passage as a vector.', x: 515, y: 135, w: 160, h: 90, tone: 'teal', icon: 'db' },
    { id: 'retriever', name: 'Retriever', role: 'Finds the passages closest to the question.', x: 420, y: 345, w: 200, h: 126, tone: 'purple', icon: 'search' },
    { id: 'prompt', name: 'Prompt builder', role: 'Combines instructions, passages and the question.', x: 756, y: 120, w: 220, h: 66, tone: 'orange', icon: 'doc' },
    { id: 'llm', name: 'Language model', role: 'Writes the answer from the prompt.', x: 756, y: 232, w: 220, h: 62, tone: 'orange', icon: 'brain' },
    { id: 'answer', name: 'Answer', role: 'The reply shown to the user.', x: 756, y: 360, w: 220, h: 110, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['question', 'embedder'],
    ['embedder', 'retriever'],
    ['vectordb', 'retriever'],
    ['retriever', 'prompt'],
    { from: 'question', to: 'prompt', route: 'above', label: 'question' },
    ['prompt', 'llm'],
    ['llm', 'answer'],
  ],
  inputs: [
    { key: 'question', label: 'Question about the Nimbus robot', kind: 'select', options: Object.keys(QUESTIONS) },
    { key: 'retrieval', label: 'Use retrieval', kind: 'toggle' },
  ],
  defaults: { question: 'Can I get a refund after three weeks?', retrieval: true },
  run,
  details,
}
