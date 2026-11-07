import type { FlowStep, Machine } from '../types'
import type { InputValues } from '../types'
import { SdBars, SdChips, SdLines, SdText } from './details'
import { Bars } from './visuals'
import { fx } from './util'

// Toy word counts from an imaginary training set of 400 spam and 600 normal emails.
const SPAM_N = 400
const HAM_N = 600
const COUNTS: Record<string, [number, number]> = {
  free: [180, 30], win: [150, 12], winner: [90, 3], prize: [120, 5], money: [140, 40], cash: [110, 10],
  click: [200, 45], offer: [130, 35], urgent: [95, 20], now: [160, 120], limited: [85, 15], deal: [70, 30],
  meeting: [8, 210], project: [10, 190], tomorrow: [25, 180], thanks: [30, 260], report: [6, 150],
  lunch: [5, 90], attached: [20, 170], schedule: [12, 140], team: [15, 200], hi: [60, 300], you: [300, 380],
}

function run(input: Record<string, unknown>): FlowStep[] {
  const text = String(input.text ?? '')
  const words = (text.toLowerCase().match(/[a-z']+/g) ?? []).slice(0, 30)
  const known = [...new Set(words)].filter((w) => w in COUNTS)
  // Log-odds with add-one smoothing.
  const contrib: [string, number][] = known.map((w) => {
    const [s, h] = COUNTS[w]
    return [w, Math.log((s + 1) / (SPAM_N + 2)) - Math.log((h + 1) / (HAM_N + 2))]
  })
  const prior = Math.log(SPAM_N / HAM_N)
  const total = prior + contrib.reduce((a, [, v]) => a + v, 0)
  const pSpam = 1 / (1 + Math.exp(-total))
  const spam = pSpam > 0.5

  return [
    {
      from: 'email',
      to: 'tokenizer',
      title: 'An email arrives',
      caption: 'Naive Bayes filters (late 1990s) were the first spam filters that really worked, and they learned from your own mail.',
      parcel: { name: 'Email', fields: [{ k: 'text', v: text || '(empty)' }] },
      memory: {
        counts: [
          { k: 'spam emails seen', v: String(SPAM_N) },
          { k: 'normal emails seen', v: String(HAM_N) },
          { k: 'words tracked', v: String(Object.keys(COUNTS).length) },
        ],
      },
    },
    {
      from: 'tokenizer',
      to: 'counts',
      title: `Split into ${words.length} words`,
      caption: `The email becomes a bag of words: order is thrown away. ${known.length} of them appear in the training statistics.`,
      parcel: { name: 'Bag of words', fields: [{ k: 'words', v: words.join(' ') || '(none)' }, { k: 'known words', v: known.join(', ') || 'none' }] },
    },
    {
      from: 'counts',
      to: 'bayes',
      title: 'Look up each word',
      caption: 'For every known word: how often did it appear in spam vs normal mail? "prize" is a strong spam signal, "meeting" a strong normal one.',
      parcel: {
        name: 'Word evidence',
        fields: known.length
          ? known.map((w) => ({ k: w, v: `${COUNTS[w][0]} spam / ${COUNTS[w][1]} normal` }))
          : [{ k: 'evidence', v: 'no known words' }],
        visual: contrib.length ? <Bars items={contrib} /> : undefined,
      },
    },
    {
      from: 'bayes',
      to: 'verdict',
      title: `${(pSpam * 100).toFixed(0)}% likely spam`,
      caption: 'Bayes’ rule combines the evidence. It is "naive" because it assumes words are independent, which is false, but works surprisingly well.',
      parcel: {
        name: 'Combined score',
        fields: [
          { k: 'prior log-odds', v: fx(prior) },
          { k: 'word evidence', v: fx(total - prior) },
          { k: 'P(spam)', v: `${(pSpam * 100).toFixed(1)}%` },
        ],
      },
      memory: { bayes: [{ k: 'P(spam)', v: `${(pSpam * 100).toFixed(1)}%` }] },
    },
    {
      from: 'verdict',
      to: 'verdict',
      title: spam ? 'Sent to spam' : 'Delivered to inbox',
      caption: 'Each time you mark mail as spam, the counts update. That is learning: no rules written, just statistics.',
      parcel: { name: 'Verdict', fields: [{ k: 'folder', v: spam ? 'spam' : 'inbox' }] },
      memory: { verdict: [{ k: 'folder', v: spam ? 'spam' : 'inbox' }] },
    },
  ]
}

function details(input: InputValues) {
  const text = String(input.text ?? '')
  const words = (text.toLowerCase().match(/[a-z']+/g) ?? []).slice(0, 30)
  const known = [...new Set(words)].filter((w) => w in COUNTS)
  const total =
    Math.log(SPAM_N / HAM_N) +
    known.reduce((a, w) => a + Math.log((COUNTS[w][0] + 1) / (SPAM_N + 2)) - Math.log((COUNTS[w][1] + 1) / (HAM_N + 2)), 0)
  const p = 1 / (1 + Math.exp(-total))
  return {
    email: <SdLines text={text || '(empty)'} max={26} lines={4} />,
    tokenizer: known.length ? <SdChips items={known} width={156} /> : <SdText text="no known words" />,
    counts: (
      <>
        <SdText text={`${Object.keys(COUNTS).length} words tracked`} y={12} />
        <SdText text={`${SPAM_N} spam, ${HAM_N} normal`} y={28} />
      </>
    ),
    bayes: (
      <>
        <SdText text={`${Math.round(p * 100)}% spam`} strong y={12} />
        <g transform="translate(0 22)">
          <SdBars items={[['P(spam)', p]]} width={126} max={1} highlight="P(spam)" />
        </g>
      </>
    ),
    verdict: <SdText text={p > 0.5 ? 'spam folder' : 'inbox'} strong y={14} />,
  }
}

export const bayesMachine: Machine = {
  id: 'naive-bayes',
  era: 'ml',
  year: 1998,
  name: 'Spam filter',
  oneLiner: 'Naive Bayes: weigh each word’s evidence using counts from past emails.',
  groups: [
    { label: 'Email', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Evidence', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Verdict', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'email', name: 'Email', role: 'The incoming message.', x: 124, y: 230, w: 190, h: 110, tone: 'blue', icon: 'doc' },
    { id: 'tokenizer', name: 'Word splitter', role: 'Breaks the text into individual words.', x: 350, y: 140, w: 180, h: 96, tone: 'teal', icon: 'tokens' },
    { id: 'counts', name: 'Word counts', role: 'How often each word appeared in spam and normal mail.', x: 350, y: 355, w: 180, h: 84, tone: 'purple', icon: 'db' },
    { id: 'bayes', name: 'Bayes’ rule', role: 'Combines all word evidence into one probability.', x: 555, y: 250, w: 150, h: 90, tone: 'orange', icon: 'chart' },
    { id: 'verdict', name: 'Folder', role: 'Inbox or spam.', x: 771, y: 250, w: 200, h: 80, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['email', 'tokenizer'],
    ['tokenizer', 'counts'],
    ['counts', 'bayes'],
    ['bayes', 'verdict'],
  ],
  inputs: [{ key: 'text', label: 'Email text', kind: 'text', maxLength: 120 }],
  defaults: { text: 'Click now to win a free prize, limited offer' },
  run,
  details,
}
