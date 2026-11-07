import type { FlowStep, Machine } from '../types'
import type { InputValues } from '../types'
import { SdBars, SdText } from './details'
import { Bars } from './visuals'
import { fx, sigmoid } from './util'

// One-dimensional toy: real "cat photos" score ~4 on some feature; the generator starts near 0.
const REAL_MEAN = 4

function run(input: Record<string, unknown>): FlowStep[] {
  const rounds = Number(input.rounds ?? 3)
  const seed = Number(input.noise ?? 0.3)
  const genMean = REAL_MEAN * (1 - 0.65 ** rounds)
  const fake = genMean + (seed - 0.5)
  const real = REAL_MEAN + 0.2
  // Discriminator draws its line halfway between what it has seen; sharper when the two are far apart.
  const boundary = (genMean + REAL_MEAN) / 2
  const sharp = Math.max(0.6, REAL_MEAN - genMean)
  const dReal = sigmoid(sharp * (real - boundary))
  const dFake = sigmoid(sharp * (fake - boundary))
  const fooled = dFake > 0.4

  return [
    {
      from: 'noise',
      to: 'gen',
      title: 'Start from random noise',
      caption: 'A GAN (Goodfellow, 2014) is two networks in a contest. The generator turns random numbers into a fake sample.',
      parcel: { name: 'Noise', fields: [{ k: 'random seed', v: fx(seed) }] },
      memory: { gen: [{ k: 'training rounds', v: String(rounds) }, { k: 'typical output', v: fx(genMean) }] },
    },
    {
      from: 'gen',
      to: 'disc',
      title: 'The generator forges a sample',
      caption: `After ${rounds} rounds of training, its fakes score around ${fx(genMean)} on our feature; real images score around ${REAL_MEAN}.`,
      parcel: { name: 'Fake sample', fields: [{ k: 'feature value', v: fx(fake) }, { k: 'real images average', v: String(REAL_MEAN) }] },
    },
    {
      from: 'real',
      to: 'disc',
      title: 'A real sample arrives too',
      caption: 'The discriminator sees real examples from the training set and fakes from the generator, without being told which is which.',
      parcel: { name: 'Real sample', fields: [{ k: 'feature value', v: fx(real) }] },
    },
    {
      from: 'disc',
      to: 'verdict',
      title: fooled ? 'The forgery passes' : 'Caught the fake',
      caption: 'The discriminator outputs the probability that each sample is real. Its own training pushes it to tell them apart.',
      parcel: {
        name: 'Discriminator scores',
        fields: [{ k: 'P(real) for real', v: fx(dReal) }, { k: 'P(real) for fake', v: fx(dFake) }],
        visual: <Bars items={[['real sample', dReal], ['fake sample', dFake]]} max={1} />,
      },
      memory: { verdict: [{ k: 'fake judged real', v: `${Math.round(dFake * 100)}%` }] },
    },
    {
      from: 'verdict',
      to: 'gen',
      title: 'The forger learns from getting caught',
      caption: 'Gradients from the discriminator tell the generator how to make its fakes more convincing. Slide training rounds up: the fakes drift toward the real data until the judge is at 50/50. Descendants of this idea, and later diffusion models, power today’s image generators.',
      parcel: { name: 'Feedback', fields: [{ k: 'gap to real', v: fx(REAL_MEAN - genMean) }, { k: 'next round', v: 'fakes move closer to real' }] },
    },
  ]
}

function details(input: InputValues) {
  const rounds = Number(input.rounds ?? 3)
  const seed = Number(input.noise ?? 0.3)
  const genMean = REAL_MEAN * (1 - 0.65 ** rounds)
  const fake = genMean + (seed - 0.5)
  const real = REAL_MEAN + 0.2
  const boundary = (genMean + REAL_MEAN) / 2
  const sharp = Math.max(0.6, REAL_MEAN - genMean)
  const dReal = sigmoid(sharp * (real - boundary))
  const dFake = sigmoid(sharp * (fake - boundary))
  return {
    noise: <SdText text={`seed ${fx(seed)}`} y={12} />,
    gen: <SdBars items={[['fake', Math.max(0, fake)], ['real avg', REAL_MEAN]]} width={196} max={5} format={(v) => fx(v, 1)} highlight="fake" />,
    real: <SdText text={`feature value ${fx(real, 1)}`} y={12} />,
    disc: <SdBars items={[['real', dReal], ['fake', dFake]]} width={196} max={1} highlight="fake" />,
    verdict: (
      <>
        <SdText text={`${Math.round(dFake * 100)}% fooled`} strong y={14} />
        <SdText text={`after ${rounds} rounds`} y={32} />
      </>
    ),
  }
}

export const ganMachine: Machine = {
  id: 'gan',
  era: 'neural',
  year: 2014,
  name: 'GAN',
  oneLiner: 'A forger network and a detective network train each other until fakes look real.',
  groups: [
    { label: 'Forger', x: 14, y: 40, w: 300, h: 412, tone: 'purple' },
    { label: 'Detective', x: 330, y: 40, w: 300, h: 412, tone: 'orange' },
    { label: 'Verdict', x: 646, y: 40, w: 240, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'noise', name: 'Random noise', role: 'Random numbers: the raw material for a fake.', x: 164, y: 135, w: 220, h: 66, tone: 'blue', icon: 'noise' },
    { id: 'gen', name: 'Generator', role: 'Turns noise into a fake sample. The forger.', x: 164, y: 340, w: 220, h: 96, tone: 'purple', icon: 'brain' },
    { id: 'real', name: 'Real data', role: 'Genuine examples from the training set.', x: 480, y: 135, w: 220, h: 66, tone: 'teal', icon: 'db' },
    { id: 'disc', name: 'Discriminator', role: 'Guesses whether a sample is real. The detective.', x: 480, y: 340, w: 220, h: 96, tone: 'orange', icon: 'search' },
    { id: 'verdict', name: 'Verdict', role: 'Real or fake, as a probability.', x: 766, y: 240, w: 200, h: 84, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['noise', 'gen'],
    ['gen', 'disc'],
    ['real', 'disc'],
    ['disc', 'verdict'],
    { from: 'verdict', to: 'gen', route: 'below' },
  ],
  inputs: [
    { key: 'rounds', label: 'Training rounds', kind: 'slider', min: 0, max: 12 },
    { key: 'noise', label: 'Random seed', kind: 'slider', min: 0, max: 1, step: 0.05 },
  ],
  defaults: { rounds: 3, noise: 0.3 },
  run,
  details,
}
