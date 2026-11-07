import type { FlowStep, Machine } from '../types'
import type { InputValues } from '../types'
import { SdLines, SdText } from './details'

interface Task {
  thought: string
  tool: string
  args: Record<string, string>
  run: () => string
  answer: (out: string) => string
}

const daysUntilNewYear = () => {
  const now = new Date()
  const ny = new Date(now.getFullYear() + 1, 0, 1)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((ny.getTime() - today.getTime()) / 86400000)
}

const TASKS: Record<string, Task> = {
  'What is an 18% tip on $46.50?': {
    thought: 'This needs exact arithmetic. Language models are unreliable at multiplying decimals, so I should use the calculator.',
    tool: 'calculator',
    args: { expression: '46.50 * 0.18' },
    run: () => (46.5 * 0.18).toFixed(2),
    answer: (o) => `An 18% tip on $46.50 is $${o}, so the total is $${(46.5 + Number(o)).toFixed(2)}.`,
  },
  'How many days until New Year’s Day?': {
    thought: 'I don’t know today’s date from training. I need the calendar tool.',
    tool: 'calendar',
    args: { from: 'today', to: 'next 1 January' },
    run: () => String(daysUntilNewYear()),
    answer: (o) => `There are ${o} days until New Year’s Day.`,
  },
  'Convert 26 °C to Fahrenheit': {
    thought: 'A unit conversion: F = C × 9/5 + 32. I’ll let the calculator do it exactly.',
    tool: 'calculator',
    args: { expression: '26 * 9 / 5 + 32' },
    run: () => String(26 * 1.8 + 32),
    answer: (o) => `26 °C is ${Number(o).toFixed(1)} °F.`,
  },
  'What’s the weather in Tokyo right now?': {
    thought: 'Weather changes constantly; my training data can’t know it. I should call the weather tool.',
    tool: 'weather',
    args: { city: 'Tokyo' },
    run: () => '18 °C, light rain (sample data)',
    answer: (o) => `Right now in Tokyo it’s ${o.replace(' (sample data)', '')}. (This demo returns sample data, not a live forecast.)`,
  },
}

function run(input: Record<string, unknown>): FlowStep[] {
  const key = (input.task as string) in TASKS ? (input.task as string) : Object.keys(TASKS)[0]
  const t = TASKS[key]
  const out = t.run()
  return [
    {
      from: 'user',
      to: 'llm',
      title: 'A task arrives',
      caption: 'An agent is a language model that can take actions: call tools, read the results and decide what to do next. Agents took off around 2023.',
      parcel: { name: 'Task', fields: [{ k: 'request', v: key }] },
      memory: { tools: [{ k: 'available', v: 'calculator, calendar, weather' }] },
    },
    {
      from: 'llm',
      to: 'llm',
      title: 'Think about what’s needed',
      caption: 'Before answering, the model reasons about whether it can answer from memory or needs outside help.',
      parcel: { name: 'Reasoning', fields: [{ k: 'thought', v: t.thought }] },
    },
    {
      from: 'llm',
      to: 'tools',
      title: `Call the ${t.tool} tool`,
      caption: 'The model writes a structured tool call (a name plus arguments). The surrounding program, not the model, actually runs it.',
      parcel: { name: 'Tool call', fields: [{ k: 'tool', v: t.tool }, ...Object.entries(t.args).map(([k, v]) => ({ k, v }))] },
      memory: { tools: [{ k: 'last call', v: t.tool }] },
    },
    {
      from: 'tools',
      to: 'result',
      title: 'The tool runs',
      caption: 'Real code executes: arithmetic, a date lookup, an API request. The output is exact and current, things a model alone can’t guarantee.',
      parcel: { name: 'Tool output', fields: [{ k: 'result', v: out }] },
    },
    {
      from: 'result',
      to: 'llm',
      title: 'Read the observation',
      caption: 'The result is added to the conversation. The model can now answer, or decide another tool call is needed; this loop can run many times for big tasks.',
      parcel: { name: 'Observation', fields: [{ k: 'from tool', v: out }, { k: 'more tools needed?', v: 'no' }] },
    },
    {
      from: 'llm',
      to: 'answer',
      title: 'Answer with real data',
      caption: 'The final answer combines the model’s language skills with the tool’s exact result. Coding assistants and research agents use this same loop with many more tools.',
      parcel: { name: 'Answer', fields: [{ k: 'reply', v: t.answer(out) }] },
      memory: { answer: [{ k: 'reply', v: t.answer(out) }] },
    },
  ]
}

function details(input: InputValues) {
  const key = (input.task as string) in TASKS ? (input.task as string) : Object.keys(TASKS)[0]
  const t = TASKS[key]
  const out = t.run()
  return {
    user: <SdLines text={key} max={24} lines={3} strong />,
    llm: <SdLines text={t.thought} max={26} lines={5} />,
    tools: (
      <>
        <SdText text={t.tool} strong y={12} />
        <SdText text={Object.values(t.args).join(', ')} max={22} y={30} />
      </>
    ),
    result: <SdLines text={out} max={20} lines={2} strong />,
    answer: <SdLines text={t.answer(out)} max={28} lines={5} />,
  }
}

export const agentMachine: Machine = {
  id: 'agent',
  era: 'engineering',
  year: 2023,
  name: 'Tool-using agent',
  oneLiner: 'A language model that decides to call tools, reads the results, and keeps going.',
  groups: [
    { label: 'You', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Agent loop', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Answer', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'user', name: 'You', role: 'Gives the agent a task.', x: 124, y: 240, w: 190, h: 100, tone: 'blue', icon: 'user' },
    { id: 'llm', name: 'Language model', role: 'Plans, chooses tools and writes the answer.', x: 350, y: 240, w: 180, h: 120, tone: 'purple', icon: 'brain' },
    { id: 'tools', name: 'Tools', role: 'Calculator, calendar and weather lookup.', x: 555, y: 130, w: 150, h: 84, tone: 'orange', icon: 'tool' },
    { id: 'result', name: 'Observation', role: 'What the tool returned.', x: 555, y: 355, w: 150, h: 76, tone: 'teal', icon: 'doc' },
    { id: 'answer', name: 'Answer', role: 'The final reply.', x: 771, y: 240, w: 200, h: 120, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['user', 'llm'],
    ['llm', 'tools'],
    ['tools', 'result'],
    ['result', 'llm'],
    ['llm', 'answer'],
  ],
  inputs: [{ key: 'task', label: 'Task', kind: 'select', options: Object.keys(TASKS) }],
  defaults: { task: 'What is an 18% tip on $46.50?' },
  run,
  details,
}
