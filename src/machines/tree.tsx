import type { FlowStep, Machine } from '../types'
import type { InputValues } from '../types'
import { SdText } from './details'
import { fx } from './util'

const DATA = [
  ['apple', 'red', 8, false], ['apple', 'red', 7, false], ['apple', 'red', 9, false], ['apple', 'green', 7, false],
  ['cherry', 'red', 2, false], ['cherry', 'red', 2, false],
  ['banana', 'yellow', 4, true], ['banana', 'yellow', 4, true],
  ['lemon', 'yellow', 6, false], ['lemon', 'yellow', 5, false],
  ['lime', 'green', 4, false], ['lime', 'green', 3, false],
] as const
type Row = (typeof DATA)[number]

const gini = (rows: readonly Row[]) => {
  if (!rows.length) return 0
  const counts = new Map<string, number>()
  rows.forEach((r) => counts.set(r[0], (counts.get(r[0]) ?? 0) + 1))
  return 1 - [...counts.values()].reduce((s, n) => s + (n / rows.length) ** 2, 0)
}
const splitScore = (groups: Row[][]) => groups.reduce((s, g) => s + (g.length / DATA.length) * gini(g), 0)
const CANDIDATES: [string, number][] = [
  ['colour', splitScore(['red', 'yellow', 'green'].map((c) => DATA.filter((r) => r[1] === c)))],
  ['wider than 5 cm', splitScore([DATA.filter((r) => r[2] > 5), DATA.filter((r) => r[2] <= 5)])],
  ['long & curved', splitScore([DATA.filter((r) => r[3]), DATA.filter((r) => !r[3])])],
]

const BRANCH: Record<string, { q: string; station: string; test: (w: number, c: boolean) => boolean; yes: string; no: string; describe: (w: number, c: boolean) => string }> = {
  red: { q: 'Wider than 5 cm?', station: 'qRed', test: (w) => w > 5, yes: 'apple', no: 'cherry', describe: (w) => `${w} cm` },
  yellow: { q: 'Long & curved?', station: 'qYellow', test: (_, c) => c, yes: 'banana', no: 'lemon', describe: (_, c) => (c ? 'curved' : 'not curved') },
  green: { q: 'Wider than 5 cm?', station: 'qGreen', test: (w) => w > 5, yes: 'apple', no: 'lime', describe: (w) => `${w} cm` },
}

function run(input: Record<string, unknown>): FlowStep[] {
  const colour = (input.colour as string) ?? 'red'
  const width = Number(input.width ?? 8)
  const curved = Boolean(input.curved)
  const b = BRANCH[colour]
  const yes = b.test(width, curved)
  const answer = yes ? b.yes : b.no
  const leafRows = DATA.filter((r) => r[0] === answer)
  return [
    {
      from: 'fruit',
      to: 'qColour',
      title: 'A mystery fruit arrives',
      caption: 'Its measurements (features) enter at the root of the tree. The tree will ask one question at a time.',
      parcel: { name: 'Features', fields: [{ k: 'colour', v: colour }, { k: 'width', v: `${width} cm` }, { k: 'curved', v: curved ? 'yes' : 'no' }] },
      memory: {
        qColour: [
          { k: 'why ask this first', v: 'cleanest split of the training data' },
          ...CANDIDATES.map(([q, s]) => ({ k: q, v: `impurity ${fx(s)}`, note: 'lower is better' })),
        ],
        fruit: [{ k: 'training examples', v: String(DATA.length) }],
      },
    },
    {
      from: 'qColour',
      to: b.station,
      title: `Colour is ${colour}`,
      caption: `Answering the root question sends the fruit down the "${colour}" branch. Everything on the other branches is now irrelevant.`,
      parcel: { name: 'Answer', fields: [{ k: 'question', v: 'Colour?' }, { k: 'answer', v: colour }] },
    },
    {
      from: b.station,
      to: 'leaf',
      title: `${b.q} ${yes ? 'Yes' : 'No'}`,
      caption: `The fruit is ${b.describe(width, curved)}, so the answer is ${yes ? 'yes' : 'no'} and it lands on a leaf.`,
      parcel: { name: 'Answer', fields: [{ k: 'question', v: b.q }, { k: 'answer', v: yes ? 'yes' : 'no' }] },
    },
    {
      from: 'leaf',
      to: 'leaf',
      title: `Prediction: ${answer}`,
      caption: `Nobody wrote these questions. The tree was grown from ${DATA.length} labelled examples by repeatedly picking the question that splits them most cleanly. Learned rules, not hand-written ones.`,
      parcel: {
        name: 'Leaf',
        fields: [
          { k: 'prediction', v: answer },
          { k: 'training fruit at this leaf', v: String(leafRows.length) },
          { k: 'questions asked', v: '2' },
        ],
      },
      memory: { leaf: [{ k: 'prediction', v: answer }] },
    },
  ]
}

function details(input: InputValues) {
  const colour = (input.colour as string) in BRANCH ? (input.colour as string) : 'red'
  const width = Number(input.width ?? 8)
  const curved = Boolean(input.curved)
  const b = BRANCH[colour]
  const answer = b.test(width, curved) ? b.yes : b.no
  const branch = (key: string) => <SdText text={`yes → ${BRANCH[key].yes}, no → ${BRANCH[key].no}`} y={10} />
  return {
    fruit: (
      <>
        {[['colour', colour], ['width', `${width} cm`], ['curved', curved ? 'yes' : 'no']].map(([k, v], i) => (
          <SdText key={k} text={`${k}: ${v}`} y={12 + i * 15} />
        ))}
      </>
    ),
    qColour: <SdText text={`→ ${colour}`} strong y={12} />,
    qRed: branch('red'),
    qYellow: branch('yellow'),
    qGreen: branch('green'),
    leaf: (
      <>
        <SdText text={answer} strong y={14} />
        <SdText text={`${DATA.filter((r) => r[0] === answer).length} training fruit here`} y={32} />
      </>
    ),
  }
}

export const treeMachine: Machine = {
  id: 'decision-tree',
  era: 'ml',
  year: 1986,
  name: 'Decision tree',
  oneLiner: 'A flowchart of yes/no questions, learned automatically from examples.',
  groups: [
    { label: 'Fruit', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Questions', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Answer', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'fruit', name: 'Fruit', role: 'The thing to classify, described by its features.', x: 124, y: 230, w: 190, h: 96, tone: 'blue', icon: 'doc' },
    { id: 'qColour', name: 'Colour?', role: 'Root question: the split that best separates the training data.', x: 330, y: 230, w: 140, h: 66, tone: 'purple', icon: 'gear' },
    { id: 'qRed', name: 'Wider than 5 cm?', role: 'Separates apples from cherries.', x: 548, y: 105, w: 170, h: 62, tone: 'pink', icon: 'gear' },
    { id: 'qYellow', name: 'Long & curved?', role: 'Separates bananas from lemons.', x: 548, y: 230, w: 170, h: 62, tone: 'orange', icon: 'gear' },
    { id: 'qGreen', name: 'Wider than 5 cm?', role: 'Separates green apples from limes.', x: 548, y: 355, w: 170, h: 62, tone: 'teal', icon: 'gear' },
    { id: 'leaf', name: 'Leaf', role: 'Where the fruit ends up: the prediction.', x: 771, y: 230, w: 200, h: 90, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['fruit', 'qColour'],
    { from: 'qColour', to: 'qRed', label: 'red' },
    { from: 'qColour', to: 'qYellow', label: 'yellow' },
    { from: 'qColour', to: 'qGreen', label: 'green' },
    ['qRed', 'leaf'],
    ['qYellow', 'leaf'],
    ['qGreen', 'leaf'],
  ],
  inputs: [
    { key: 'colour', label: 'Colour', kind: 'select', options: ['red', 'yellow', 'green'] },
    { key: 'width', label: 'Width', kind: 'slider', min: 1, max: 12, unit: 'cm' },
    { key: 'curved', label: 'Long & curved', kind: 'toggle' },
  ],
  defaults: { colour: 'red', width: 8, curved: false },
  run,
  details,
}
