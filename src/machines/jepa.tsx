import type { FlowStep, InputValues, Machine } from '../types'
import { Cells, Vector } from './visuals'
import { SdBars, SdGrid, SdText } from './details'
import { ART } from './diffusion'
import { fx } from './util'

const MASKS: Record<string, [number, number]> = {
  'Top-left block': [1, 1],
  'Centre block': [3, 3],
  'Bottom-right block': [5, 5],
}
const B = 4 // hidden block is 4×4 pixels

type Grid = number[][]
const block = (g: Grid, r0: number, c0: number) => g.slice(r0, r0 + B).map((row) => row.slice(c0, c0 + B))

/** A 4-number summary of a block: how much ink, where it sits (row, column), how busy its edges are. */
function embed(b: Grid): number[] {
  let ink = 0, rs = 0, cs = 0, edges = 0
  b.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v) {
        ink++
        rs += r
        cs += c
      }
      if (c + 1 < B && row[c + 1] !== v) edges++
      if (r + 1 < B && b[r + 1][c] !== v) edges++
    }),
  )
  const n = B * B
  return [ink / n, ink ? rs / ink / (B - 1) : 0.5, ink ? cs / ink / (B - 1) : 0.5, edges / (2 * B * (B - 1))]
}

function compute(input: InputValues) {
  const image = (input.image as string) in ART ? (input.image as string) : 'a heart'
  const maskName = (input.mask as string) in MASKS ? (input.mask as string) : 'Top-left block'
  const latent = input.latent !== false
  const [r0, c0] = MASKS[maskName]
  const px: Grid = ART[image].map((r) => [...r].map((c) => (c === '#' ? 1 : 0)))
  const hidden = block(px, r0, c0)
  // The predictor's guess uses context: most drawings are roughly mirror-symmetric, so look at the mirrored block.
  const mc0 = 10 - B - c0
  const mirrored = block(px, r0, mc0).map((row) => [...row].reverse())
  const target = embed(hidden)
  const predicted = embed(mirrored)
  const latentError = Math.sqrt(target.reduce((s, v, i) => s + (v - predicted[i]) ** 2, 0) / target.length)
  const pixelError = hidden.flat().reduce((s, v, i) => s + Math.abs(v - mirrored.flat()[i]), 0) / (B * B)
  const visible = px.map((row, r) => row.map((v, c) => (r >= r0 && r < r0 + B && c >= c0 && c < c0 + B ? 'mask' : v)))
  return { image, maskName, latent, px, hidden, mirrored, target, predicted, latentError, pixelError, visible }
}

function run(input: InputValues): FlowStep[] {
  const { latent, hidden, mirrored, target, predicted, latentError, pixelError, maskName, visible } = compute(input)
  const visGrid = visible.map((row) => row.map((v) => (v === 'mask' ? 'wall' : v ? 1 : 0)))
  return [
    {
      from: 'image',
      to: 'ctxenc',
      title: 'Hide part of the picture',
      caption: `JEPA (Joint Embedding Predictive Architecture), proposed by Yann LeCun in 2022, learns without labels: hide a part of the input and learn to predict it. Here the ${maskName.toLowerCase()} is hidden; the rest is the context.`,
      parcel: { name: 'Visible context', fields: [{ k: 'hidden', v: `${B}×${B} block` }, { k: 'labels needed', v: 'none' }], visual: <Cells grid={visGrid} size={14} /> },
      memory: { tgtenc: [{ k: 'updated by', v: 'slow average of context encoder' }] },
    },
    {
      from: 'image',
      to: 'tgtenc',
      title: 'The hidden block goes to a target encoder',
      caption: 'A second encoder sees only the hidden block. It is a slowly-updated copy of the context encoder (an exponential moving average), which keeps training stable.',
      parcel: { name: 'Hidden block', fields: [{ k: 'pixels', v: `${B * B}` }], visual: <Cells grid={hidden} size={18} /> },
    },
    {
      from: 'ctxenc',
      to: 'predictor',
      title: 'Encode what is visible',
      caption: 'The context encoder (a vision transformer) turns the visible patches into embeddings: compact summaries of shapes, not raw pixels.',
      parcel: { name: 'Context embedding', fields: [{ k: 'from', v: 'visible patches' }, { k: 'shape', v: 'one vector per patch' }] },
    },
    {
      from: 'predictor',
      to: 'loss',
      title: 'Guess the hidden part’s summary',
      caption: 'The predictor uses the context to guess the embedding of the hidden block, not its pixels. Here it reasons that the shape is roughly mirror-symmetric.',
      parcel: {
        name: 'Predicted embedding',
        fields: ['ink', 'row', 'column', 'edges'].map((k, i) => ({ k, v: fx(predicted[i]) })),
        visual: <Vector label="guess" values={predicted} />,
      },
    },
    {
      from: 'tgtenc',
      to: 'loss',
      title: 'The real summary arrives',
      caption: 'The target encoder produces the true embedding of the hidden block.',
      parcel: { name: 'Target embedding', fields: ['ink', 'row', 'column', 'edges'].map((k, i) => ({ k, v: fx(target[i]) })), visual: <Vector label="target" values={target} /> },
    },
    {
      from: 'loss',
      to: 'loss',
      title: latent ? `Compare summaries: error ${fx(latentError)}` : `Compare pixels: error ${fx(pixelError)}`,
      caption: latent
        ? 'The loss compares embeddings, so the model only has to get the gist right, not every detail. Generative models must predict every pixel, wasting effort on details that don’t matter. Meta’s I-JEPA (2023) and V-JEPA 2 (2025), which helps robots plan by predicting what happens next, are built this way.'
        : 'Predicting raw pixels punishes every small mismatch, even unimportant ones. Turn embedding-space prediction back on to compare: the same guess scores much better when only the summary has to match.',
      parcel: {
        name: latent ? 'Embedding-space loss' : 'Pixel-space loss',
        fields: [
          { k: 'embedding error', v: fx(latentError) },
          { k: 'pixel error', v: fx(pixelError) },
          { k: 'trained on', v: latent ? 'summaries (JEPA)' : 'pixels (generative)' },
        ],
        visual: <Cells grid={mirrored} size={18} />,
      },
      memory: { loss: [{ k: 'error', v: fx(latent ? latentError : pixelError) }] },
    },
  ]
}

function details(input: InputValues) {
  const { latent, visible, target, predicted, latentError, pixelError } = compute(input)
  const grid = visible.map((row) => row.map((v) => (v === 'mask' ? 'wall' : v ? 1 : 0)))
  return {
    image: <SdGrid grid={grid} cell={13} />,
    ctxenc: (
      <>
        <SdText text="visible patches →" y={12} />
        <SdText text="embeddings" y={28} />
      </>
    ),
    tgtenc: (
      <>
        <SdText text="hidden block →" y={12} />
        <SdText text="slow-moving copy" y={28} />
      </>
    ),
    predictor: <SdBars items={[['guess', predicted[0]], ['target', target[0]]]} width={156} max={1} format={(v) => fx(v)} />,
    loss: (
      <>
        <SdText text={latent ? 'embedding space' : 'pixel space'} strong y={12} />
        <g transform="translate(0 22)">
          <SdBars items={[['summary', latentError], ['pixels', pixelError]]} width={176} max={1} highlight={latent ? 'summary' : 'pixels'} format={(v) => fx(v)} />
        </g>
      </>
    ),
  }
}

export const jepaMachine: Machine = {
  id: 'jepa',
  era: 'transformers',
  year: 2023,
  name: 'JEPA (world models)',
  oneLiner: 'Learn by predicting summaries of hidden parts, not pixels: Yann LeCun’s path to world models.',
  groups: [
    { label: 'Input with a hidden part', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Two encoders', x: 250, y: 40, w: 200, h: 412, tone: 'purple' },
    { label: 'Predict and compare in embedding space', x: 466, y: 40, w: 420, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'image', name: 'Image', role: 'The input, with one block hidden.', x: 124, y: 240, w: 190, h: 176, tone: 'blue', icon: 'image' },
    { id: 'ctxenc', name: 'Context encoder', role: 'Turns the visible parts into embeddings.', x: 350, y: 130, w: 180, h: 80, tone: 'teal', icon: 'brain' },
    { id: 'tgtenc', name: 'Target encoder', role: 'A slowly-updated copy that embeds the hidden part.', x: 350, y: 350, w: 180, h: 80, tone: 'purple', icon: 'brain' },
    { id: 'predictor', name: 'Predictor', role: 'Guesses the hidden part’s embedding from the context.', x: 580, y: 130, w: 190, h: 96, tone: 'orange', icon: 'route' },
    { id: 'loss', name: 'Compare embeddings', role: 'Measures how far the guess is from the real summary.', x: 770, y: 300, w: 200, h: 110, tone: 'green', icon: 'chart' },
  ],
  wires: [
    { from: 'image', to: 'ctxenc', label: 'visible' },
    { from: 'image', to: 'tgtenc', label: 'hidden' },
    ['ctxenc', 'predictor'],
    ['predictor', 'loss'],
    ['tgtenc', 'loss'],
  ],
  inputs: [
    { key: 'image', label: 'Image', kind: 'select', options: Object.keys(ART) },
    { key: 'mask', label: 'Hidden part', kind: 'select', options: Object.keys(MASKS) },
    { key: 'latent', label: 'Predict in embedding space (JEPA)', kind: 'toggle' },
  ],
  defaults: { image: 'a heart', mask: 'Top-left block', latent: true },
  run,
  details,
}
