import type { FlowStep, Machine } from '../types'
import type { InputValues } from '../types'
import { SdLines, SdText } from './details'

interface Puzzle {
  quick: string
  thoughts: [string, string, string]
  check: [string, string]
  answer: string
}
const PUZZLES: Record<string, Puzzle> = {
  'Bat and ball: $1.10 total, bat costs $1 more. Ball?': {
    quick: '10 cents',
    thoughts: [
      'Let the ball cost b. The bat costs b + 1.00.',
      'Together: b + (b + 1.00) = 1.10, so 2b = 0.10.',
      'So b = 0.05. The ball costs 5 cents.',
    ],
    check: ['Try 10 cents: bat $1.10, total $1.20. Wrong.', 'Try 5 cents: bat $1.05, total $1.10, and the difference is $1.00. Correct.'],
    answer: '5 cents',
  },
  '5 machines make 5 widgets in 5 min. 100 machines, 100 widgets?': {
    quick: '100 minutes',
    thoughts: [
      'Each machine makes 1 widget in 5 minutes.',
      'With 100 machines working at once, each makes its own widget.',
      'So 100 widgets also take 5 minutes.',
    ],
    check: ['Try 100 minutes: that would mean each machine takes 100 minutes per widget. Wrong.', 'Rate is 1 widget per machine per 5 minutes, so 100 machines make 100 widgets in 5 minutes. Correct.'],
    answer: '5 minutes',
  },
  'Lily pads double daily, cover the pond on day 48. Half covered?': {
    quick: 'Day 24',
    thoughts: [
      'The covered area doubles every day.',
      'If it is full on day 48, the day before it must have been half as much.',
      'So it is half covered on day 47.',
    ],
    check: ['Try day 24: doubling for 24 more days multiplies the area by about 16 million. Wrong.', 'Day 47 at half, doubled once, is full on day 48. Correct.'],
    answer: 'Day 47',
  },
}

function run(input: Record<string, unknown>): FlowStep[] {
  const key = (input.puzzle as string) in PUZZLES ? (input.puzzle as string) : Object.keys(PUZZLES)[0]
  const p = PUZZLES[key]
  const think = input.think !== false

  if (!think)
    return [
      {
        from: 'question',
        to: 'fast',
        title: 'Answer straight away',
        caption: 'A standard model starts writing its answer immediately, one token at a time, with no scratch space to work things out.',
        parcel: { name: 'Question', fields: [{ k: 'puzzle', v: key }] },
        memory: { think: [{ k: 'thinking tokens', v: '0' }] },
      },
      {
        from: 'fast',
        to: 'answer',
        title: `Quick answer: ${p.quick}`,
        caption: 'The first answer that "sounds right" wins, and here it is wrong. Many people make the same slip. Turn "Think first" on to compare.',
        parcel: { name: 'Answer', fields: [{ k: 'reply', v: p.quick }, { k: 'correct?', v: 'no' }] },
        memory: { answer: [{ k: 'reply', v: p.quick }, { k: 'correct?', v: 'no' }] },
      },
    ]

  return [
    {
      from: 'question',
      to: 'think',
      title: 'Think before answering',
      caption: 'Reasoning models (OpenAI o1 in 2024, DeepSeek-R1 in early 2025) first write a hidden chain of thought: working notes the user usually doesn’t see.',
      parcel: { name: 'Question', fields: [{ k: 'puzzle', v: key }] },
      memory: { think: [{ k: 'thinking tokens', v: 'starting' }] },
    },
    {
      from: 'think',
      to: 'check',
      title: 'Set up the problem',
      caption: 'Instead of jumping to an answer, it writes the problem out step by step.',
      parcel: { name: 'Thought 1–2', fields: [{ k: 'step 1', v: p.thoughts[0] }, { k: 'step 2', v: p.thoughts[1] }] },
      memory: { think: [{ k: 'thinking tokens', v: '~60' }] },
    },
    {
      from: 'check',
      to: 'think',
      title: 'Test the tempting answer',
      caption: 'It checks the intuitive answer and finds it fails. Catching its own mistakes is a key skill these models learn.',
      parcel: { name: 'Self-check', fields: [{ k: 'test', v: p.check[0] }] },
    },
    {
      from: 'think',
      to: 'check',
      title: 'Work it out',
      caption: 'It finishes the reasoning and verifies the new answer against the original question.',
      parcel: { name: 'Thought 3', fields: [{ k: 'step 3', v: p.thoughts[2] }, { k: 'verify', v: p.check[1] }] },
      memory: { think: [{ k: 'thinking tokens', v: '~140' }], check: [{ k: 'verified', v: 'yes' }] },
    },
    {
      from: 'check',
      to: 'answer',
      title: `Answer: ${p.answer}`,
      caption: 'These models are trained with reinforcement learning on problems with checkable answers, such as maths and code, and are rewarded for getting them right. Longer thinking costs more tokens and time but gives better answers on hard problems.',
      parcel: { name: 'Answer', fields: [{ k: 'reply', v: p.answer }, { k: 'correct?', v: 'yes' }] },
      memory: { answer: [{ k: 'reply', v: p.answer }, { k: 'correct?', v: 'yes' }] },
    },
  ]
}

function details(input: InputValues) {
  const key = (input.puzzle as string) in PUZZLES ? (input.puzzle as string) : Object.keys(PUZZLES)[0]
  const p = PUZZLES[key]
  const think = input.think !== false
  const off = <SdText text="skipped: thinking off" />
  return {
    question: <SdLines text={key} max={24} lines={4} />,
    fast: think ? <SdText text="not used" /> : <SdText text={p.quick} strong y={12} />,
    think: think ? <SdLines text={p.thoughts.join(' ')} max={26} lines={5} /> : off,
    check: think ? <SdLines text="tempting answer fails; new answer checks out" max={20} lines={3} /> : off,
    answer: (
      <>
        <SdText text={think ? p.answer : p.quick} strong y={14} />
        <SdText text={think ? 'correct' : 'wrong'} y={32} />
      </>
    ),
  }
}

export const reasoningMachine: Machine = {
  id: 'reasoning',
  era: 'transformers',
  year: 2024,
  name: 'Reasoning model',
  oneLiner: 'Write out a chain of thought and check it before answering.',
  groups: [
    { label: 'Question', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Thinking', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Answer', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'question', name: 'Question', role: 'The problem to solve.', x: 124, y: 240, w: 190, h: 110, tone: 'blue', icon: 'doc' },
    { id: 'fast', name: 'Quick answer', role: 'Answering immediately, with no working.', x: 350, y: 120, w: 180, h: 70, tone: 'pink', icon: 'route' },
    { id: 'think', name: 'Chain of thought', role: 'Step-by-step working notes.', x: 350, y: 340, w: 180, h: 120, tone: 'purple', icon: 'brain' },
    { id: 'check', name: 'Self-check', role: 'Tests answers against the question.', x: 555, y: 340, w: 150, h: 96, tone: 'teal', icon: 'check' },
    { id: 'answer', name: 'Answer', role: 'What the user finally sees.', x: 771, y: 240, w: 200, h: 84, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['question', 'fast'],
    ['question', 'think'],
    ['think', 'check'],
    ['check', 'answer'],
    ['fast', 'answer'],
  ],
  inputs: [
    { key: 'puzzle', label: 'Puzzle', kind: 'select', options: Object.keys(PUZZLES) },
    { key: 'think', label: 'Think first', kind: 'toggle' },
  ],
  defaults: { puzzle: 'Bat and ball: $1.10 total, bat costs $1 more. Ball?', think: true },
  run,
  details,
}
