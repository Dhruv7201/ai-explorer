import type { Field, FlowStep, Machine } from '../types'
import type { InputValues } from '../types'
import { SdChips, SdLines, SdText } from './details'

const OBSERVATIONS = [
  'has fur', 'has feathers', 'eats meat', 'eats grass', 'tawny coat',
  'dark spots', 'black stripes', 'black & white stripes', 'has hooves', 'can fly',
]

const RULES = [
  { id: 'R1', when: ['has fur'], then: 'mammal' },
  { id: 'R2', when: ['has feathers'], then: 'bird' },
  { id: 'R3', when: ['mammal', 'eats meat'], then: 'carnivore' },
  { id: 'R4', when: ['mammal', 'has hooves'], then: 'hoofed animal' },
  { id: 'R5', when: ['carnivore', 'tawny coat', 'dark spots'], then: 'cheetah' },
  { id: 'R6', when: ['carnivore', 'tawny coat', 'black stripes'], then: 'tiger' },
  { id: 'R7', when: ['hoofed animal', 'black & white stripes'], then: 'zebra' },
  { id: 'R8', when: ['bird', 'eats meat', 'can fly'], then: 'eagle' },
]
const ANIMALS = new Set(['cheetah', 'tiger', 'zebra', 'eagle'])
const ruleText = (r: (typeof RULES)[number]) => `IF ${r.when.join(' AND ')} THEN ${r.then}`

function run(input: Record<string, unknown>): FlowStep[] {
  const observed = (input.observed as string[]) ?? []
  const known = [...observed]
  const fired: string[] = []
  const memoryFields = (): Field[] =>
    known.map((f) => ({ k: f, v: observed.includes(f) ? 'seen' : 'worked out' }))

  const steps: FlowStep[] = [
    {
      from: 'you',
      to: 'memory',
      title: 'You describe the animal',
      caption: `You report ${observed.length} observation${observed.length === 1 ? '' : 's'}. They go into working memory, the system's scratchpad of known facts.`,
      parcel: { name: 'Observations', fields: observed.map((o) => ({ k: o, v: 'true' })) },
      memory: {
        memory: memoryFields(),
        rules: RULES.map((r) => ({ k: r.id, v: ruleText(r) })),
        engine: [{ k: 'Fired so far', v: 'nothing yet' }],
      },
    },
    {
      from: 'memory',
      to: 'engine',
      title: 'The engine reads the facts',
      caption: 'The inference engine is the only part that "thinks". It compares the facts against every rule, looking for one whose conditions are all true.',
      parcel: { name: 'Known facts', fields: known.map((k) => ({ k, v: 'true' })) },
    },
  ]

  // Forward chaining: keep firing rules until a full pass adds nothing new.
  let changed = true
  while (changed) {
    changed = false
    for (const r of RULES) {
      if (fired.includes(r.id) || !r.when.every((c) => known.includes(c))) continue
      fired.push(r.id)
      steps.push({
        from: 'rules',
        to: 'engine',
        title: `Rule ${r.id} matches`,
        caption: `Every condition of ${r.id} is already known, so the rule fires.`,
        parcel: {
          name: `Rule ${r.id}`,
          fields: [...r.when.map((c) => ({ k: c, v: 'known', note: 'condition' })), { k: 'then', v: r.then }],
        },
        memory: { engine: [{ k: 'Fired so far', v: fired.join(', ') }] },
      })
      if (!known.includes(r.then)) known.push(r.then)
      steps.push({
        from: 'engine',
        to: 'memory',
        title: `New fact: ${r.then}`,
        caption: `The conclusion of ${r.id} becomes a fact in its own right, which may unlock more rules.`,
        parcel: { name: 'New fact', fields: [{ k: r.then, v: 'true', note: `from ${r.id}` }] },
        memory: { memory: memoryFields() },
      })
      changed = true
    }
  }

  // Show the closest miss among the animal rules, if any.
  const misses = RULES.filter((r) => ANIMALS.has(r.then) && !fired.includes(r.id))
    .map((r) => ({ r, missing: r.when.filter((c) => !known.includes(c)) }))
    .filter((m) => m.missing.length < m.r.when.length)
    .sort((a, b) => a.missing.length - b.missing.length)
  if (misses[0]) {
    const { r, missing } = misses[0]
    steps.push({
      from: 'rules',
      to: 'engine',
      title: `Rule ${r.id} doesn't match`,
      caption: `${r.id} would conclude "${r.then}", but it is missing: ${missing.join(', ')}. Rules are all-or-nothing.`,
      parcel: {
        name: `Rule ${r.id}`,
        fields: r.when.map((c) => ({ k: c, v: known.includes(c) ? 'known' : 'missing' })),
      },
    })
  }

  const answer = known.find((k) => ANIMALS.has(k))
  steps.push({
    from: 'memory',
    to: 'answer',
    title: answer ? `It's a ${answer}` : 'No conclusion',
    caption: answer
      ? `Chain of reasoning: ${fired.join(' then ')}. Every step can be explained, which is why expert systems were trusted in medicine.`
      : 'No rule leads to an animal. Nobody wrote a rule for this case, so the system has nothing to say. This brittleness is why AI moved toward learning from data.',
    parcel: {
      name: 'Conclusion',
      fields: [
        { k: 'animal', v: answer ?? 'unknown' },
        { k: 'rules fired', v: String(fired.length) },
      ],
    },
    memory: { answer: [{ k: 'Answer', v: answer ?? 'unknown' }] },
  })
  return steps
}

function details(input: InputValues) {
  const steps = run(input)
  const mem: Record<string, Field[]> = {}
  steps.forEach((s) => Object.assign(mem, s.memory ?? {}))
  const observed = (input.observed as string[]) ?? []
  const fired = (mem.engine?.[0]?.v ?? '').split(', ').filter((x) => x.startsWith('R'))
  const derived = (mem.memory ?? []).filter((f) => f.v === 'worked out').map((f) => f.k)
  return {
    you: observed.length ? <SdChips items={observed} width={166} max={10} /> : <SdText text="nothing observed yet" />,
    memory: derived.length ? <SdChips items={derived} width={156} /> : <SdText text="nothing worked out yet" />,
    engine: <SdLines text={fired.length ? `fired ${fired.join(', ')}` : 'no rule fired'} max={24} lines={2} />,
    rules: (
      <>
        {RULES.map((r, i) => (
          <text key={r.id} y={11 + i * 14} className={fired.includes(r.id) ? 'sd-strong' : 'sd-text'}>
            {`${r.id} → ${r.then}`}
          </text>
        ))}
      </>
    ),
    answer: <SdText text={mem.answer?.[0]?.v ?? 'unknown'} strong y={14} />,
  }
}

export const expertMachine: Machine = {
  id: 'expert-system',
  era: 'classic',
  year: 1972,
  name: 'Expert system',
  oneLiner: 'Human experts write IF/THEN rules; an engine chains them into a conclusion.',
  groups: [
    { label: 'Facts', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Reasoning', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Conclusion', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'you', name: 'You', role: 'Describes what they can see.', x: 124, y: 230, w: 190, h: 110, tone: 'blue', icon: 'user' },
    { id: 'memory', name: 'Working memory', role: 'Holds every fact known so far.', x: 350, y: 140, w: 180, h: 100, tone: 'teal', icon: 'db' },
    { id: 'engine', name: 'Inference engine', role: 'Matches facts against rules and fires the ones that apply.', x: 350, y: 355, w: 180, h: 90, tone: 'purple', icon: 'gear' },
    { id: 'rules', name: 'Rule base', role: 'IF/THEN rules written by a human expert.', x: 555, y: 255, w: 150, h: 160, tone: 'orange', icon: 'rules' },
    { id: 'answer', name: 'Answer', role: 'The final conclusion, if one is reached.', x: 771, y: 140, w: 200, h: 80, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['you', 'memory'],
    ['memory', 'engine'],
    ['engine', 'rules'],
    ['memory', 'answer'],
  ],
  inputs: [{ key: 'observed', label: 'What you see', kind: 'chips', options: OBSERVATIONS }],
  defaults: { observed: ['has fur', 'eats meat', 'tawny coat', 'dark spots'] },
  run,
  details,
}
