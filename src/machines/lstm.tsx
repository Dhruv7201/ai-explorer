import type { FlowStep, Machine } from '../types'
import type { InputValues } from '../types'
import { SdBars, SdChips, SdText } from './details'
import { fx } from './util'
import { Bars } from './visuals'

// Hand-set "weights" so the mechanism is readable: a sentiment memory plus a negation memory.
const SENTIMENT: Record<string, number> = {
  good: 1, great: 1.5, love: 1.5, fun: 1, brilliant: 1.5, enjoyed: 1, beautiful: 1,
  bad: -1, boring: -1.2, hate: -1.5, awful: -1.5, dull: -1, slow: -0.6, terrible: -1.5,
}
const NEGATORS = new Set(['not', "didn't", 'never', 'no', "wasn't", "isn't"])

function run(input: Record<string, unknown>): FlowStep[] {
  const words = (String(input.text ?? '').toLowerCase().match(/[a-z']+/g) ?? []).slice(0, 16)
  const forget = Number(input.forget ?? 0.9)
  let mood = 0
  let negate = 0
  const trace: { w: string; f: number; i: number; mood: number; negate: number; note: string }[] = []
  for (const w of words) {
    let note = 'neutral word: memory just fades a little'
    let inGate = 0
    mood *= forget
    if (NEGATORS.has(w)) {
      negate = 1
      inGate = 1
      note = 'negation: store a "flip the next feeling" flag'
    } else if (w in SENTIMENT) {
      const s = SENTIMENT[w] * (negate ? -1 : 1)
      mood += s
      inGate = 1
      note = negate ? `"${w}" arrives while the flag is set, so its feeling is flipped` : `"${w}" carries feeling, so it is written into memory`
      negate = 0
    } else {
      negate *= forget
    }
    trace.push({ w, f: forget, i: inGate, mood, negate, note })
  }
  const positive = mood >= 0
  const shown = trace.slice(0, 6)

  return [
    ...shown.map((t, idx) => ({
      from: idx === 0 ? 'word' : 'cell',
      to: idx === 0 ? 'gates' : 'gates',
      title: `Read "${t.w}"`,
      caption:
        idx === 0
          ? `Recurrent networks read one word at a time and carry a memory forward. The LSTM (1997) added gates that decide what to forget and what to store. ${t.note}.`
          : `${t.note[0].toUpperCase()}${t.note.slice(1)}.`,
      parcel: {
        name: `Word ${idx + 1}: ${t.w}`,
        fields: [
          { k: 'forget gate', v: fx(t.f), note: 'how much old memory to keep' },
          { k: 'input gate', v: fx(t.i), note: 'how much of this word to store' },
          { k: 'memory: feeling', v: fx(t.mood) },
          { k: 'memory: negation flag', v: fx(t.negate) },
        ],
      },
      memory: { cell: [{ k: 'feeling', v: fx(t.mood) }, { k: 'negation flag', v: fx(t.negate) }, { k: 'words read', v: String(idx + 1) }] },
    })),
    ...(trace.length > shown.length
      ? [
          {
            from: 'gates',
            to: 'cell',
            title: `Read ${trace.length - shown.length} more words`,
            caption: 'The same cell processes every remaining word, passing its memory forward each time.',
            parcel: { name: 'Remaining words', fields: [{ k: 'words', v: trace.slice(shown.length).map((t) => t.w).join(' ') }] },
            memory: { cell: [{ k: 'feeling', v: fx(mood) }, { k: 'words read', v: String(trace.length) }] },
          },
        ]
      : []),
    {
      from: 'cell',
      to: 'hidden',
      title: 'Read out the memory',
      caption: 'After the last word, the memory summarises the whole sentence. Lower the forget gate and early words fade before the end: the long-term memory problem LSTMs were built to ease.',
      parcel: { name: 'Final memory', fields: [{ k: 'feeling', v: fx(mood) }], visual: <Bars items={trace.map((t, i) => [`${i + 1}. ${t.w}`, t.mood])} /> },
    },
    {
      from: 'hidden',
      to: 'output',
      title: positive ? 'Positive review' : 'Negative review',
      caption: 'Reading strictly in order is slow and still forgets over long texts. Transformers (2017) replaced it by letting every word look at every other word at once.',
      parcel: { name: 'Prediction', fields: [{ k: 'sentiment', v: positive ? 'positive' : 'negative' }, { k: 'score', v: fx(mood) }] },
      memory: { output: [{ k: 'sentiment', v: positive ? 'positive' : 'negative' }] },
    },
  ]
}

function details(input: InputValues) {
  const words = (String(input.text ?? '').toLowerCase().match(/[a-z']+/g) ?? []).slice(0, 16)
  const forget = Number(input.forget ?? 0.9)
  let mood = 0
  let negate = 0
  for (const w of words) {
    mood *= forget
    if (NEGATORS.has(w)) negate = 1
    else if (w in SENTIMENT) {
      mood += SENTIMENT[w] * (negate ? -1 : 1)
      negate = 0
    } else negate *= forget
  }
  return {
    word: <SdChips items={words} width={166} max={14} />,
    gates: <SdBars items={[['forget', forget], ['input', 1]]} width={156} max={1} format={(v) => fx(v)} />,
    cell: (
      <>
        <SdText text={`feeling ${mood >= 0 ? '+' : ''}${fx(mood)}`} y={12} />
        <SdText text={`negation flag ${fx(negate)}`} y={28} />
      </>
    ),
    hidden: <SdText text={`${mood >= 0 ? '+' : ''}${fx(mood)}`} strong y={14} />,
    output: <SdText text={mood >= 0 ? 'positive' : 'negative'} strong y={14} />,
  }
}

export const lstmMachine: Machine = {
  id: 'lstm',
  era: 'neural',
  year: 1997,
  name: 'Recurrent network (LSTM)',
  oneLiner: 'Read a sentence one word at a time, carrying a memory that gates decide to keep or forget.',
  groups: [
    { label: 'Input', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'LSTM cell', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Output', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'word', name: 'Next word', role: 'The sentence enters one word per time step.', x: 124, y: 230, w: 190, h: 110, tone: 'blue', icon: 'tokens' },
    { id: 'gates', name: 'Gates', role: 'Forget gate and input gate decide what changes in memory.', x: 350, y: 140, w: 180, h: 90, tone: 'teal', icon: 'rules' },
    { id: 'cell', name: 'Cell memory', role: 'Carried from word to word; the network’s running summary.', x: 350, y: 350, w: 180, h: 80, tone: 'purple', icon: 'layers', stack: '× each word' },
    { id: 'hidden', name: 'Hidden state', role: 'What the network outputs from its memory.', x: 555, y: 250, w: 150, h: 76, tone: 'orange', icon: 'vector' },
    { id: 'output', name: 'Sentiment', role: 'Positive or negative.', x: 771, y: 250, w: 200, h: 76, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['word', 'gates'],
    ['gates', 'cell'],
    ['cell', 'hidden'],
    ['hidden', 'output'],
  ],
  inputs: [
    { key: 'text', label: 'Review', kind: 'text', maxLength: 80 },
    { key: 'forget', label: 'Forget gate', kind: 'slider', min: 0.2, max: 1, step: 0.05 },
  ],
  defaults: { text: 'the plot was slow but i did not find it boring', forget: 0.9 },
  run,
  details,
}
