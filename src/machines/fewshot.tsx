import type { FlowStep, InputValues, Machine } from '../types'
import { SdLines, SdText } from './details'

interface Task {
  instruction: string
  examples: [string, string][]
  query: string
  zeroShot: string
  fewShot: string
}
const TASKS: Record<string, Task> = {
  'Label review sentiment': {
    instruction: 'Classify the review.',
    examples: [
      ['The food was amazing!', 'positive'],
      ['Waited an hour, never again.', 'negative'],
      ['It was fine, nothing special.', 'neutral'],
    ],
    query: 'Loved the staff but the room was tiny.',
    zeroShot: 'This review expresses mixed feelings: the reviewer appreciated the staff but was disappointed by the small room, so overall it is somewhat positive with a negative aspect.',
    fewShot: 'mixed',
  },
  'Turn a sentence into an emoji': {
    instruction: 'Convert the sentence.',
    examples: [
      ['I love pizza', '❤️🍕'],
      ['It is raining today', '🌧️📅'],
      ['Let’s go to the beach', '🏃‍♀️🏖️'],
    ],
    query: 'My cat is sleeping',
    zeroShot: 'Sure! Here is the sentence converted: “My feline companion is currently resting.”',
    fewShot: '🐱😴',
  },
}

function compute(input: InputValues) {
  const key = (input.task as string) in TASKS ? (input.task as string) : Object.keys(TASKS)[0]
  const shots = Number(input.shots ?? 2)
  const t = TASKS[key]
  const used = t.examples.slice(0, shots)
  const output = shots === 0 ? t.zeroShot : t.fewShot
  return { key, shots, t, used, output }
}

function run(input: InputValues): FlowStep[] {
  const { shots, t, used, output } = compute(input)
  const prompt = [t.instruction, ...used.map(([a, b]) => `Input: ${a} → Output: ${b}`), `Input: ${t.query} → Output:`].join('  ')
  return [
    {
      from: 'instruction',
      to: 'prompt',
      title: 'Start with an instruction',
      caption: 'Large models can learn a new task from the prompt alone, with no training. GPT-3 (2020) showed this “in-context learning”, and it is still the first tool to reach for.',
      parcel: { name: 'Instruction', fields: [{ k: 'text', v: t.instruction }] },
    },
    {
      from: 'examples',
      to: 'prompt',
      title: shots === 0 ? 'Zero-shot: no examples' : `${shots}-shot: add ${shots} example${shots > 1 ? 's' : ''}`,
      caption: shots === 0 ? 'With no examples the model has to guess what format you want.' : 'Each example shows an input and the exact output you expect. The model copies the pattern: format, length and style.',
      parcel: { name: 'Examples', fields: used.length ? used.map(([a, b], i) => ({ k: `example ${i + 1}`, v: `${a} → ${b}` })) : [{ k: 'examples', v: 'none' }] },
      memory: { examples: [{ k: 'shots', v: String(shots) }] },
    },
    {
      from: 'prompt',
      to: 'model',
      title: 'One prompt, all in context',
      caption: 'Instruction, examples and the new input are joined into a single prompt. The model’s weights never change; it only reads.',
      parcel: { name: 'Prompt', fields: [{ k: 'text', v: prompt }] },
    },
    {
      from: 'model',
      to: 'output',
      title: shots === 0 ? 'A rambling answer' : 'An answer in exactly your format',
      caption:
        shots === 0
          ? 'Zero-shot output is often correct but in the wrong shape: chatty, too long, hard to parse. Slide the examples up to compare.'
          : 'With examples the output matches the pattern. Combine this with chain-of-thought (“think step by step”) or structured output (JSON schemas) for reliable results in apps.',
      parcel: { name: 'Output', fields: [{ k: 'reply', v: output }] },
      memory: { output: [{ k: 'reply', v: output }] },
    },
  ]
}

function details(input: InputValues) {
  const { shots, t, used, output } = compute(input)
  return {
    instruction: <SdText text={t.instruction} strong y={12} />,
    examples: used.length ? <>{used.map(([a, b], i) => <SdText key={i} text={`${a} → ${b}`} y={12 + i * 15} max={30} />)}</> : <SdText text="none (zero-shot)" />,
    prompt: <SdText text={`instruction + ${shots} example${shots === 1 ? '' : 's'} + input`} y={12} max={34} />,
    model: <SdText text="reads, weights unchanged" y={12} />,
    output: <SdLines text={output} max={28} lines={4} strong={shots > 0} />,
  }
}

export const fewshotMachine: Machine = {
  id: 'few-shot-prompting',
  era: 'engineering',
  year: 2020,
  name: 'Few-shot prompting',
  oneLiner: 'Teach a model a task with a few examples in the prompt: in-context learning.',
  groups: [
    { label: 'What you write', x: 14, y: 40, w: 300, h: 412, tone: 'blue' },
    { label: 'Model', x: 330, y: 40, w: 300, h: 412, tone: 'purple' },
    { label: 'Result', x: 646, y: 40, w: 240, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'instruction', name: 'Instruction', role: 'What you want done.', x: 164, y: 120, w: 240, h: 66, tone: 'blue', icon: 'doc' },
    { id: 'examples', name: 'Examples', role: 'Input → output pairs showing the pattern.', x: 164, y: 330, w: 240, h: 96, tone: 'orange', icon: 'rules' },
    { id: 'prompt', name: 'Prompt', role: 'Everything joined into one input.', x: 480, y: 160, w: 220, h: 66, tone: 'teal', icon: 'doc' },
    { id: 'model', name: 'Language model', role: 'Reads the prompt and continues the pattern.', x: 480, y: 340, w: 220, h: 66, tone: 'purple', icon: 'brain' },
    { id: 'output', name: 'Output', role: 'The model’s reply.', x: 766, y: 240, w: 200, h: 110, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['instruction', 'prompt'],
    ['examples', 'prompt'],
    ['prompt', 'model'],
    ['model', 'output'],
  ],
  inputs: [
    { key: 'task', label: 'Task', kind: 'select', options: Object.keys(TASKS) },
    { key: 'shots', label: 'Number of examples', kind: 'slider', min: 0, max: 3 },
  ],
  defaults: { task: 'Label review sentiment', shots: 2 },
  run,
  details,
}
