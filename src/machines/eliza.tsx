import type { FlowStep, Machine } from '../types'
import type { InputValues } from '../types'
import { SdChips, SdLines, SdText } from './details'

// Original example patterns in the spirit of ELIZA's keyword-and-template approach.
const PATTERNS: { name: string; re: RegExp; reply: (m: string[]) => string; rank: number }[] = [
  { name: 'feeling', re: /\bi feel (.+)/i, reply: (m) => `What makes you feel ${m[1]}?`, rank: 5 },
  { name: 'state of being', re: /\bi am (.+)/i, reply: (m) => `How long have you been ${m[1]}?`, rank: 4 },
  { name: 'need', re: /\bi (?:need|want) (.+)/i, reply: (m) => `What would it mean to you to get ${m[1]}?`, rank: 4 },
  { name: 'family', re: /\b(mother|father|mom|dad|sister|brother|family)\b/i, reply: (m) => `Tell me more about your ${m[1].toLowerCase()}.`, rank: 6 },
  { name: 'machines', re: /\b(computer|machine|robot|ai)\b/i, reply: () => 'Does talking to a machine change what you are willing to say?', rank: 7 },
  { name: 'reason', re: /\bbecause (.+)/i, reply: (m) => `Is "${m[1]}" the whole reason?`, rank: 3 },
  { name: 'you', re: /\byou (?:are|seem) (.+)/i, reply: (m) => `Why do you think I am ${m[1]}?`, rank: 3 },
]
const SWAPS: Record<string, string> = { i: 'you', me: 'you', my: 'your', am: 'are', mine: 'yours', you: 'I', your: 'my', myself: 'yourself' }
const swap = (s: string) =>
  s
    .replace(/[.!?]+$/, '')
    .split(/\s+/)
    .map((w) => SWAPS[w.toLowerCase()] ?? w)
    .join(' ')

function run(input: Record<string, unknown>): FlowStep[] {
  const text = String(input.text ?? '').trim() || 'Hello'
  const hits = PATTERNS.map((p) => ({ p, m: text.match(p.re) }))
    .filter((h): h is { p: (typeof PATTERNS)[number]; m: RegExpMatchArray } => h.m !== null)
    .sort((a, b) => b.p.rank - a.p.rank)
  const best = hits[0]
  const captured = best?.m[1] ?? ''
  const swapped = best ? swap(captured) : ''
  const reply = best ? best.p.reply([best.m[0], swapped]) : 'Please, go on.'

  return [
    {
      from: 'you',
      to: 'scanner',
      title: 'You type a message',
      caption: 'ELIZA (1966) was one of the first chatbots. It understands nothing; it only scans for keywords.',
      parcel: { name: 'Message', fields: [{ k: 'text', v: text }] },
      memory: { patterns: PATTERNS.map((p) => ({ k: p.name, v: p.re.source, note: `rank ${p.rank}` })) },
    },
    {
      from: 'scanner',
      to: 'patterns',
      title: hits.length ? `${hits.length} keyword pattern${hits.length > 1 ? 's' : ''} match` : 'No keyword found',
      caption: hits.length
        ? 'Each pattern has a rank. When several match, the highest-ranked one wins.'
        : 'Nothing matched, so ELIZA falls back to a stock phrase that keeps the conversation going.',
      parcel: {
        name: 'Matches',
        fields: hits.length ? hits.map((h) => ({ k: h.p.name, v: `"${h.m[0]}"`, note: `rank ${h.p.rank}` })) : [{ k: 'matches', v: 'none' }],
      },
      memory: { scanner: [{ k: 'last match', v: best?.p.name ?? 'none' }] },
    },
    ...(best && captured
      ? [
          {
            from: 'patterns',
            to: 'swapper',
            title: 'Flip the pronouns',
            caption: 'Words captured from your sentence are reflected back: "my" becomes "your", "I" becomes "you".',
            parcel: { name: 'Fragment', fields: [{ k: 'captured', v: captured }, { k: 'reflected', v: swapped }] },
          },
        ]
      : []),
    {
      from: best && captured ? 'swapper' : 'patterns',
      to: 'reply',
      title: 'Fill in the template',
      caption: 'The reply is a template with your own words slotted in. People still felt understood; this became known as the ELIZA effect.',
      parcel: { name: 'Reply', fields: [{ k: 'ELIZA', v: reply }] },
      memory: { reply: [{ k: 'said', v: reply }] },
    },
  ]
}

function details(input: InputValues) {
  const steps = run(input)
  const text = String(input.text ?? '').trim() || 'Hello'
  const hits = PATTERNS.filter((p) => p.re.test(text)).sort((a, b) => b.rank - a.rank)
  const reply = steps[steps.length - 1].parcel.fields[0].v
  const swapStep = steps.find((s) => s.to === 'swapper')
  return {
    you: <SdLines text={`“${text}”`} max={26} lines={3} strong />,
    scanner: hits.length ? <SdChips items={hits.map((h) => h.name)} width={156} /> : <SdText text="no keyword found" />,
    patterns: (
      <>
        <SdText text={hits[0]?.name ?? 'fallback'} strong y={12} />
        <SdText text={hits[0] ? `rank ${hits[0].rank} wins` : 'stock phrase'} y={30} />
      </>
    ),
    swapper: swapStep ? (
      <>
        <SdText text={swapStep.parcel.fields[0].v} max={20} y={12} />
        <SdText text={`→ ${swapStep.parcel.fields[1].v}`} max={20} y={30} />
      </>
    ) : (
      <SdText text="not needed" />
    ),
    reply: <SdLines text={reply} max={28} lines={4} strong />,
  }
}

export const elizaMachine: Machine = {
  id: 'eliza',
  era: 'classic',
  year: 1966,
  name: 'ELIZA chatbot',
  oneLiner: 'Pattern matching and fill-in-the-blank replies that felt like conversation.',
  groups: [
    { label: 'You', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Pattern matching', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Response', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'you', name: 'You', role: 'Types a message.', x: 124, y: 230, w: 190, h: 110, tone: 'blue', icon: 'user' },
    { id: 'scanner', name: 'Keyword scanner', role: 'Looks for known keywords and phrases.', x: 350, y: 140, w: 180, h: 96, tone: 'teal', icon: 'search' },
    { id: 'patterns', name: 'Pattern rules', role: 'Ranked patterns, each with a reply template.', x: 350, y: 350, w: 180, h: 96, tone: 'purple', icon: 'rules' },
    { id: 'swapper', name: 'Pronoun swap', role: 'Reflects your words back from ELIZA’s point of view.', x: 553, y: 350, w: 150, h: 96, tone: 'pink', icon: 'route' },
    { id: 'reply', name: 'Reply', role: 'The finished sentence ELIZA prints.', x: 771, y: 230, w: 200, h: 140, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['you', 'scanner'],
    ['scanner', 'patterns'],
    ['patterns', 'swapper'],
    ['swapper', 'reply'],
    { from: 'patterns', to: 'reply', route: 'below' },
  ],
  inputs: [{ key: 'text', label: 'Say something to ELIZA', kind: 'text', maxLength: 80 }],
  defaults: { text: 'I feel nervous about my exams' },
  run,
  details,
}
