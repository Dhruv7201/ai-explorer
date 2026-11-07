import type { FlowStep, Machine } from '../types'
import type { InputValues } from '../types'
import { SdBars, SdLines, SdText } from './details'
import { Bars } from './visuals'
import { fx } from './util'

interface Answer {
  text: string
  traits: { helpful: number; clear: number; safe: number; long: number }
}
const PROMPTS: Record<string, [Answer, Answer]> = {
  'Explain gravity to a 7-year-old': [
    { text: 'Gravity is the curvature of spacetime described by general relativity, where mass-energy tells spacetime how to curve.', traits: { helpful: 0.3, clear: 0.2, safe: 1, long: 0.6 } },
    { text: 'Gravity is an invisible pull. The Earth is so big it pulls everything towards it, which is why a ball falls down when you drop it.', traits: { helpful: 0.9, clear: 0.95, safe: 1, long: 0.5 } },
  ],
  'Write a polite reply declining a meeting': [
    { text: 'No.', traits: { helpful: 0.1, clear: 0.6, safe: 0.8, long: 0.05 } },
    { text: 'Thanks for the invite. I can’t make Thursday, but I’d be glad to catch up next week if that works for you.', traits: { helpful: 0.9, clear: 0.9, safe: 1, long: 0.4 } },
  ],
  'How do I pick a strong password?': [
    { text: 'Use a long passphrase of four or more random words, and a different one for every site. A password manager makes that easy.', traits: { helpful: 0.95, clear: 0.9, safe: 1, long: 0.5 } },
    { text: 'Just use your pet’s name and birthday so you won’t forget it.', traits: { helpful: 0.2, clear: 0.8, safe: 0.1, long: 0.2 } },
  ],
}
const START_W = { helpful: 0.3, clear: 0.3, safe: 0.3, long: 0.6 } // before feedback, the reward model likes long answers
type Traits = Answer['traits']
const score = (w: Traits, t: Traits) => (Object.keys(w) as (keyof Traits)[]).reduce((s, k) => s + w[k] * t[k], 0)

function run(input: Record<string, unknown>): FlowStep[] {
  const prompt = (input.prompt as string) in PROMPTS ? (input.prompt as string) : Object.keys(PROMPTS)[0]
  const [A, B] = PROMPTS[prompt]
  const prefersA = input.preference === 'Answer A'
  const [win, lose] = prefersA ? [A, B] : [B, A]
  const before = { A: score(START_W, A.traits), B: score(START_W, B.traits) }
  // One step of preference learning: move weights towards the traits of the preferred answer.
  const lr = 0.8
  const w = { ...START_W }
  for (const k of Object.keys(w) as (keyof Traits)[]) w[k] += lr * (win.traits[k] - lose.traits[k])
  const after = { A: score(w, A.traits), B: score(w, B.traits) }

  return [
    {
      from: 'prompt',
      to: 'base',
      title: 'Start from a pretrained model',
      caption: 'A model trained only to predict internet text is knowledgeable but unhelpful: it may ramble, refuse oddly or say harmful things. RLHF (InstructGPT, 2022; then ChatGPT) teaches it what people actually want.',
      parcel: { name: 'Prompt', fields: [{ k: 'text', v: prompt }] },
      memory: { reward: Object.entries(START_W).map(([k, v]) => ({ k: `cares about ${k}`, v: fx(v) })) },
    },
    {
      from: 'base',
      to: 'answers',
      title: 'Sample two answers',
      caption: 'The model writes two different responses to the same prompt.',
      parcel: { name: 'Two answers', fields: [{ k: 'A', v: A.text }, { k: 'B', v: B.text }] },
    },
    {
      from: 'answers',
      to: 'human',
      title: `A person prefers ${prefersA ? 'A' : 'B'}`,
      caption: 'A human rater compares them and picks the better one. Choose the other answer with the input below and watch the reward model learn the opposite lesson.',
      parcel: { name: 'Comparison', fields: [{ k: 'preferred', v: prefersA ? 'A' : 'B' }, { k: 'rejected', v: prefersA ? 'B' : 'A' }] },
      memory: { human: [{ k: 'last choice', v: prefersA ? 'A' : 'B' }] },
    },
    {
      from: 'human',
      to: 'reward',
      title: 'Train a reward model',
      caption: 'Thousands of these comparisons train a reward model: a network that predicts how much a person would like any answer.',
      parcel: {
        name: 'Reward scores',
        fields: [
          { k: 'A before', v: fx(before.A) },
          { k: 'B before', v: fx(before.B) },
          { k: 'A after', v: fx(after.A) },
          { k: 'B after', v: fx(after.B) },
        ],
        visual: <Bars items={[['A before', before.A], ['B before', before.B], ['A after', after.A], ['B after', after.B]]} highlight={prefersA ? 'A after' : 'B after'} />,
      },
      memory: { reward: (Object.keys(w) as (keyof Traits)[]).map((k) => ({ k: `cares about ${k}`, v: fx(w[k]) })) },
    },
    {
      from: 'reward',
      to: 'update',
      title: 'Score new answers automatically',
      caption: 'Now the reward model can grade millions of answers without a person. Answers it scores highly are reinforced.',
      parcel: { name: 'Learned preferences', fields: (Object.keys(w) as (keyof Traits)[]).map((k) => ({ k, v: `${fx(START_W[k])} → ${fx(w[k])}` })) },
    },
    {
      from: 'update',
      to: 'base',
      title: 'Nudge the model',
      caption: 'Reinforcement learning (often PPO) adjusts the language model to earn higher rewards, with a penalty for drifting too far from the original so it doesn’t learn to game the scorer. Newer methods like DPO skip the separate reward model.',
      parcel: { name: 'Update', fields: [{ k: 'method', v: 'PPO with KL penalty' }, { k: 'effect', v: `more answers like ${prefersA ? 'A' : 'B'}` }] },
    },
  ]
}

function details(input: InputValues) {
  const prompt = (input.prompt as string) in PROMPTS ? (input.prompt as string) : Object.keys(PROMPTS)[0]
  const [A, B] = PROMPTS[prompt]
  const prefersA = input.preference === 'Answer A'
  const [win, lose] = prefersA ? [A, B] : [B, A]
  const w = { ...START_W }
  for (const k of Object.keys(w) as (keyof Traits)[]) w[k] += 0.8 * (win.traits[k] - lose.traits[k])
  const clip = (t: string) => (t.length > 30 ? `${t.slice(0, 29)}…` : t)
  return {
    prompt: <SdLines text={prompt} max={18} lines={3} />,
    base: <SdText text="pretrained on web text" y={12} />,
    answers: (
      <>
        <text y={12} className={prefersA ? 'sd-strong' : 'sd-text'}>{`A: ${clip(A.text)}`}</text>
        <text y={30} className={prefersA ? 'sd-text' : 'sd-strong'}>{`B: ${clip(B.text)}`}</text>
      </>
    ),
    human: <SdText text={`prefers ${prefersA ? 'A' : 'B'}`} strong y={12} />,
    reward: <SdBars items={[['A', score(w, A.traits)], ['B', score(w, B.traits)]]} width={206} highlight={prefersA ? 'A' : 'B'} format={(v) => fx(v)} />,
    update: <SdText text="PPO with a KL penalty" y={12} />,
  }
}

export const rlhfMachine: Machine = {
  id: 'rlhf',
  era: 'transformers',
  year: 2022,
  name: 'RLHF',
  oneLiner: 'Reinforcement learning from human feedback: teaching a model what people prefer.',
  groups: [
    { label: 'Generate answers', x: 170, y: 30, w: 560, h: 175, tone: 'teal' },
    { label: 'Learn from feedback', x: 170, y: 255, w: 560, h: 195, tone: 'orange' },
  ],
  stations: [
    { id: 'prompt', name: 'Prompt', role: 'A request to answer.', x: 88, y: 240, w: 146, h: 100, tone: 'blue', icon: 'doc' },
    { id: 'base', name: 'Language model', role: 'Pretrained on text; being tuned.', x: 310, y: 105, w: 190, h: 70, tone: 'purple', icon: 'brain' },
    { id: 'answers', name: 'Two answers', role: 'Different responses to the same prompt.', x: 590, y: 110, w: 240, h: 90, tone: 'teal', icon: 'doc' },
    { id: 'human', name: 'Human rater', role: 'Picks the better answer.', x: 815, y: 240, w: 140, h: 70, tone: 'pink', icon: 'user' },
    { id: 'reward', name: 'Reward model', role: 'Learns to predict which answers people like.', x: 590, y: 345, w: 240, h: 96, tone: 'orange', icon: 'chart' },
    { id: 'update', name: 'RL update', role: 'Adjusts the model to earn more reward.', x: 310, y: 345, w: 190, h: 70, tone: 'orange', icon: 'gear' },
  ],
  wires: [
    ['prompt', 'base'],
    ['base', 'answers'],
    ['answers', 'human'],
    ['human', 'reward'],
    ['reward', 'update'],
    ['update', 'base'],
  ],
  inputs: [
    { key: 'prompt', label: 'Prompt', kind: 'select', options: Object.keys(PROMPTS) },
    { key: 'preference', label: 'You prefer', kind: 'select', options: ['Answer A', 'Answer B'] },
  ],
  defaults: { prompt: 'Explain gravity to a 7-year-old', preference: 'Answer B' },
  run,
  details,
}
