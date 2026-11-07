import type { FlowStep, Machine } from '../types'
import type { ReactNode } from 'react'
import type { InputValues } from '../types'
import { SdBars, SdChips, SdText } from './details'
import { Bars } from './visuals'
import { fx, hash, rng } from './util'

// Real experts don't specialise this tidily; the labels make the routing readable.
const EXPERTS = [
  { id: 'e1', name: 'Expert 1', topic: 'numbers & maths', test: (t: string) => /^\d+$|^(plus|minus|times|sum|equals|half|percent)$/i.test(t) },
  { id: 'e2', name: 'Expert 2', topic: 'code', test: (t: string) => /^(def|function|return|python|code|bug|print|var|const|=|\(|\))$/i.test(t) },
  { id: 'e3', name: 'Expert 3', topic: 'grammar words', test: (t: string) => /^(the|a|an|is|are|of|to|and|in|on|it|was|be)$/i.test(t) },
  { id: 'e4', name: 'Expert 4', topic: 'names & facts', test: (t: string) => /^[A-Z][a-z]+$/.test(t) },
]

function route(token: string) {
  const r = rng(hash(token))
  const logits = EXPERTS.map((e) => (e.test(token) ? 2.5 : 0) + r() * 1.2)
  const m = Math.max(...logits)
  const ex = logits.map((l) => Math.exp(l - m))
  const s = ex.reduce((a, b) => a + b, 0)
  return ex.map((v) => v / s)
}

function run(input: Record<string, unknown>): FlowStep[] {
  const text = String(input.text ?? '').trim() || 'Paris is the capital of France'
  const k = Number(input.topk ?? 2)
  const tokens = (text.match(/[A-Za-z]+|\d+|[=()]/g) ?? []).slice(0, 10)
  const routes = tokens.map((t) => {
    const p = route(t)
    const order = p.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0])
    return { t, p, chosen: order.slice(0, k).map(([, i]) => i) }
  })
  const load = EXPERTS.map((_, i) => routes.filter((r) => r.chosen.includes(i)).length)
  const shown = routes.slice(0, 3)

  return [
    {
      from: 'tokens',
      to: 'router',
      title: `${tokens.length} tokens arrive`,
      caption: 'Giant models are expensive to run. A mixture of experts splits one big layer into many smaller "expert" networks and runs only a few of them per token.',
      parcel: { name: 'Tokens', fields: [{ k: 'tokens', v: tokens.join(' | ') }] },
      memory: Object.fromEntries(EXPERTS.map((e) => [e.id, [{ k: 'toy specialty', v: e.topic }]])),
    },
    ...shown.flatMap((r) => {
      const top = r.chosen[0]
      return [
        {
          from: 'router',
          to: EXPERTS[top].id,
          title: `Route "${r.t}"`,
          caption: `The router, a small learned network, scores every expert for this token and sends it to the top ${k}. The other experts stay idle for this token.`,
          parcel: {
            name: `“${r.t}”`,
            fields: EXPERTS.map((e, i) => ({ k: `${e.name} (${e.topic})`, v: fx(r.p[i]), note: r.chosen.includes(i) ? 'selected' : undefined })),
            visual: <Bars items={EXPERTS.map((e, i) => [e.name, r.p[i]])} max={1} highlight={EXPERTS[top].name} />,
          },
        },
        {
          from: EXPERTS[top].id,
          to: 'combine',
          title: 'Blend the experts’ outputs',
          caption: 'Each selected expert processes the token, and their outputs are mixed using the router’s weights.',
          parcel: { name: 'Weighted mix', fields: r.chosen.map((i) => ({ k: EXPERTS[i].name, v: `weight ${fx(r.p[i])}` })) },
        },
      ]
    }),
    {
      from: 'combine',
      to: 'combine',
      title: `Only ${k} of ${EXPERTS.length} experts per token`,
      caption: `Every token used just ${k} of ${EXPERTS.length} experts, so most of the model sat idle each time. DeepSeek-V3 (Dec 2024) has 671 billion parameters but activates only about 37 billion per token, which is how it stays affordable to run. It also keeps a "shared" expert that every token passes through.`,
      parcel: {
        name: 'Expert workload',
        fields: [...EXPERTS.map((e, i) => ({ k: e.name, v: `${load[i]} tokens` })), { k: 'share of experts active', v: `${Math.round((k / EXPERTS.length) * 100)}%` }],
        visual: <Bars items={EXPERTS.map((e, i) => [e.name, load[i]])} />,
      },
      memory: Object.fromEntries(EXPERTS.map((e, i) => [e.id, [{ k: 'tokens handled', v: String(load[i]) }, { k: 'toy specialty', v: e.topic }]])),
    },
  ]
}

function details(input: InputValues) {
  const text = String(input.text ?? '').trim() || 'Paris is the capital of France'
  const k = Number(input.topk ?? 2)
  const tokens = (text.match(/[A-Za-z]+|\d+|[=()]/g) ?? []).slice(0, 10)
  const load = EXPERTS.map((_, i) =>
    tokens.filter((t) => {
      const p = route(t)
      return p.map((v, j) => [v, j] as const).sort((a, b) => b[0] - a[0]).slice(0, k).some(([, j]) => j === i)
    }).length,
  )
  const out: Record<string, ReactNode> = {
    tokens: <SdChips items={tokens} width={166} max={12} />,
    router: (
      <>
        <SdText text={`top ${k} of ${EXPERTS.length}`} strong y={12} max={11} />
        <SdText text="per token" y={28} />
      </>
    ),
    combine: <SdBars items={EXPERTS.map((e, i) => [e.name, load[i]] as [string, number])} width={166} max={Math.max(1, tokens.length)} format={String} />,
  }
  EXPERTS.forEach((e, i) => {
    out[e.id] = (
      <>
        <SdText text={e.topic} y={9} />
        <g transform="translate(0 15)">
          <SdBars items={[['tokens', load[i]]]} width={136} max={Math.max(1, tokens.length)} format={String} />
        </g>
      </>
    )
  })
  return out
}

export const moeMachine: Machine = {
  id: 'mixture-of-experts',
  era: 'transformers',
  year: 2024,
  name: 'Mixture of experts',
  oneLiner: 'A router sends each token to a few specialist sub-networks, as in DeepSeek and Mixtral.',
  groups: [
    { label: 'Tokens', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Router & experts', x: 250, y: 40, w: 400, h: 412, tone: 'purple' },
    { label: 'Combine', x: 666, y: 40, w: 220, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'tokens', name: 'Tokens', role: 'The text, split into tokens.', x: 124, y: 230, w: 190, h: 110, tone: 'blue', icon: 'tokens' },
    { id: 'router', name: 'Router', role: 'Picks which experts handle each token.', x: 305, y: 230, w: 104, h: 76, tone: 'purple', icon: 'route' },
    { id: 'e1', name: 'Expert 1', role: 'One of the expert networks.', x: 562, y: 90, w: 160, h: 76, tone: 'teal', icon: 'brain' },
    { id: 'e2', name: 'Expert 2', role: 'One of the expert networks.', x: 562, y: 184, w: 160, h: 76, tone: 'orange', icon: 'brain' },
    { id: 'e3', name: 'Expert 3', role: 'One of the expert networks.', x: 562, y: 278, w: 160, h: 76, tone: 'pink', icon: 'brain' },
    { id: 'e4', name: 'Expert 4', role: 'One of the expert networks.', x: 562, y: 372, w: 160, h: 76, tone: 'blue', icon: 'brain' },
    { id: 'combine', name: 'Combine', role: 'Mixes the chosen experts’ outputs.', x: 776, y: 230, w: 190, h: 126, tone: 'green', icon: 'chart' },
  ],
  wires: [
    ['tokens', 'router'],
    ['router', 'e1'],
    ['router', 'e2'],
    ['router', 'e3'],
    ['router', 'e4'],
    ['e1', 'combine'],
    ['e2', 'combine'],
    ['e3', 'combine'],
    ['e4', 'combine'],
  ],
  inputs: [
    { key: 'text', label: 'Sentence', kind: 'text', maxLength: 60 },
    { key: 'topk', label: 'Experts per token (top-k)', kind: 'slider', min: 1, max: 4 },
  ],
  defaults: { text: 'Paris is the capital of France', topk: 2 },
  run,
  details,
}
