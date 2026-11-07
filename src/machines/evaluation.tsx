import type { FlowStep, InputValues, Machine } from '../types'
import { Bars } from './visuals'
import { SdBars, SdText } from './details'
import { fx } from './util'

// 20 test emails: the model's spam score and whether each really was spam.
const EMAILS: [number, boolean][] = [
  [0.97, true], [0.93, true], [0.9, true], [0.86, false], [0.82, true], [0.78, true], [0.71, false], [0.66, true],
  [0.61, true], [0.55, false], [0.5, true], [0.44, false], [0.4, false], [0.35, true], [0.3, false], [0.24, false],
  [0.18, false], [0.12, false], [0.08, false], [0.04, false],
]

function compute(input: InputValues) {
  const t = Number(input.threshold ?? 0.5)
  let tp = 0, fp = 0, tn = 0, fn = 0
  for (const [s, spam] of EMAILS) {
    const flag = s >= t
    if (flag && spam) tp++
    else if (flag && !spam) fp++
    else if (!flag && spam) fn++
    else tn++
  }
  const precision = tp + fp ? tp / (tp + fp) : 0
  const recall = tp + fn ? tp / (tp + fn) : 0
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0
  return { t, tp, fp, tn, fn, precision, recall, f1, accuracy: (tp + tn) / EMAILS.length }
}

const pct = (v: number) => `${Math.round(v * 100)}%`

function run(input: InputValues): FlowStep[] {
  const { t, tp, fp, tn, fn, precision, recall, f1, accuracy } = compute(input)
  const sweep = [0.2, 0.35, 0.5, 0.65, 0.8].map((x) => [`at ${x}`, compute({ threshold: x }).f1] as [string, number])
  return [
    {
      from: 'scores',
      to: 'threshold',
      title: `${EMAILS.length} test emails, scored`,
      caption: 'A model is only as good as its evaluation. We test it on emails it never saw in training, and compare its spam scores with the truth.',
      parcel: { name: 'Model scores', fields: EMAILS.slice(0, 5).map(([s, spam], i) => ({ k: `email ${i + 1}`, v: fx(s), note: spam ? 'really spam' : 'really fine' })) },
    },
    {
      from: 'threshold',
      to: 'matrix',
      title: `Flag anything scoring ≥ ${t}`,
      caption: 'A threshold turns scores into decisions. Every choice of threshold trades one kind of mistake for another.',
      parcel: { name: 'Decisions', fields: [{ k: 'flagged as spam', v: String(tp + fp) }, { k: 'let through', v: String(tn + fn) }] },
    },
    {
      from: 'matrix',
      to: 'metrics',
      title: 'Count the four outcomes',
      caption: 'The confusion matrix sorts every prediction: caught spam (true positive), false alarm (false positive), missed spam (false negative) and correctly passed mail (true negative).',
      parcel: {
        name: 'Confusion matrix',
        fields: [
          { k: 'true positives', v: String(tp), note: 'spam caught' },
          { k: 'false positives', v: String(fp), note: 'good mail blocked' },
          { k: 'false negatives', v: String(fn), note: 'spam missed' },
          { k: 'true negatives', v: String(tn), note: 'good mail delivered' },
        ],
      },
      memory: { matrix: [{ k: 'TP / FP', v: `${tp} / ${fp}` }] },
    },
    {
      from: 'metrics',
      to: 'f1',
      title: `Precision ${pct(precision)}, recall ${pct(recall)}`,
      caption: `Precision: of the emails flagged, how many were spam? Recall: of all the spam, how much was caught? Accuracy alone (${pct(accuracy)} here) can hide which mistakes you make. Move the threshold to watch them trade off.`,
      parcel: { name: 'Metrics', fields: [{ k: 'precision', v: pct(precision) }, { k: 'recall', v: pct(recall) }, { k: 'accuracy', v: pct(accuracy) }] },
    },
    {
      from: 'f1',
      to: 'f1',
      title: `F1 score: ${fx(f1)}`,
      caption: 'F1 is the harmonic mean of precision and recall: high only when both are. Sweeping the threshold and plotting the trade-off gives the ROC and precision-recall curves.',
      parcel: { name: 'F1 across thresholds', fields: sweep.map(([k, v]) => ({ k, v: fx(v) })), visual: <Bars items={sweep} max={1} highlight={`at ${t}`} /> },
      memory: { f1: [{ k: 'F1', v: fx(f1) }] },
    },
  ]
}

function details(input: InputValues) {
  const { t, tp, fp, tn, fn, precision, recall, f1 } = compute(input)
  const cell = (x: number, y: number, v: number, label: string, good: boolean) => (
    <g transform={`translate(${x} ${y})`}>
      <rect width={74} height={34} rx={3} className="sd-cell" style={{ fill: good ? 'color-mix(in srgb, var(--pos) 30%, transparent)' : 'color-mix(in srgb, var(--neg) 26%, transparent)' }} />
      <text x={8} y={15} className="sd-strong">{v}</text>
      <text x={8} y={28} className="sd-text">{label}</text>
    </g>
  )
  return {
    scores: (
      <>
        <line x1={0} y1={30} x2={166} y2={30} className="sd-plotline thin" />
        {EMAILS.map(([s, spam], i) => (
          <circle key={i} cx={s * 166} cy={spam ? 20 : 40} r={3} className={`sd-dot ${spam ? 'c1' : 'c0'}`} />
        ))}
        <line x1={t * 166} y1={8} x2={t * 166} y2={52} className="sd-plotline" />
        <SdText text="pink = really spam" y={70} />
      </>
    ),
    threshold: <SdText text={`flag if score ≥ ${t}`} strong y={12} />,
    matrix: (
      <>
        {cell(0, 0, tp, 'caught', true)}
        {cell(78, 0, fp, 'false alarm', false)}
        {cell(0, 38, fn, 'missed', false)}
        {cell(78, 38, tn, 'passed', true)}
      </>
    ),
    metrics: <SdBars items={[['precision', precision], ['recall', recall]]} width={126} max={1} />,
    f1: <SdText text={`F1 = ${fx(f1)}`} strong y={14} />,
  }
}

export const evaluationMachine: Machine = {
  id: 'model-evaluation',
  era: 'ml',
  year: 1955,
  name: 'Model evaluation',
  oneLiner: 'Confusion matrix, precision, recall and F1: how to tell if a model is any good.',
  groups: [
    { label: 'Test the model', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Count the mistakes', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Summarise', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'scores', name: 'Model scores', role: 'Spam scores for emails the model never trained on.', x: 124, y: 230, w: 190, h: 120, tone: 'blue', icon: 'chart' },
    { id: 'threshold', name: 'Threshold', role: 'Scores above it are flagged as spam.', x: 350, y: 120, w: 180, h: 66, tone: 'teal', icon: 'rules' },
    { id: 'matrix', name: 'Confusion matrix', role: 'Counts of the four possible outcomes.', x: 350, y: 330, w: 180, h: 116, tone: 'purple', icon: 'grid' },
    { id: 'metrics', name: 'Precision & recall', role: 'How trustworthy the flags are, and how much spam is caught.', x: 558, y: 230, w: 150, h: 90, tone: 'orange', icon: 'chart' },
    { id: 'f1', name: 'F1 score', role: 'One number balancing precision and recall.', x: 771, y: 230, w: 200, h: 70, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['scores', 'threshold'],
    ['threshold', 'matrix'],
    ['matrix', 'metrics'],
    ['metrics', 'f1'],
  ],
  inputs: [{ key: 'threshold', label: 'Spam threshold', kind: 'slider', min: 0.05, max: 0.95, step: 0.05 }],
  defaults: { threshold: 0.5 },
  run,
  details,
}
