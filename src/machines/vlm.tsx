import type { FlowStep, InputValues, Machine } from '../types'
import { Cells, Heat, Vector } from './visuals'
import { SdChips, SdGrid, SdHeat, SdLines, SdText, SdVectors } from './details'
import { ART } from './diffusion'
import { fx, hash, rng } from './util'

const QUESTIONS = ['What is in the picture?', 'Describe its shape.', 'Is this an animal?']
const ANSWERS: Record<string, string[]> = {
  'a house': ['A small house with a pointed roof and a door.', 'A triangle roof on top of a square base.', 'No, it is a building.'],
  'a heart': ['A heart shape.', 'Two rounded bumps at the top that meet in a point at the bottom.', 'No, it is a heart symbol.'],
  'a tree': ['A pine tree.', 'A tall triangle of leaves on a short trunk.', 'No, it is a plant.'],
  'a smiley': ['A smiling face.', 'A circle with two eyes and a curved smile.', 'No, it is a drawing of a face.'],
}
const PATCH = 2 // 10×10 image → 5×5 = 25 patches of 2×2 pixels
const LAYERS = 24 // as in CLIP ViT-L/14, a common vision tower
const D = 6 // toy vector size (CLIP ViT-L/14 uses 1,024)

const softmax = (xs: number[]) => {
  const m = Math.max(...xs)
  const e = xs.map((x) => Math.exp(x - m))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / s)
}

function compute(input: InputValues) {
  const image = (input.image as string) in ART ? (input.image as string) : 'a house'
  const question = QUESTIONS.includes(input.question as string) ? (input.question as string) : QUESTIONS[0]
  const layer = Number(input.layer ?? LAYERS - 1)
  const px = ART[image].map((r) => [...r].map((c) => (c === '#' ? 1 : 0)))
  const patches: number[][] = []
  for (let r = 0; r < 10; r += PATCH)
    for (let c = 0; c < 10; c += PATCH) patches.push([px[r][c], px[r][c + 1], px[r + 1][c], px[r + 1][c + 1]])
  const ink = patches.map((p) => p.reduce((a, b) => a + b, 0) / 4)

  // Patch embedding: a fixed toy projection of the 4 pixels, plus a position signal.
  const rand = rng(hash(image) % 1000)
  const proj = Array.from({ length: D }, () => Array.from({ length: 4 }, () => rand() * 2 - 1))
  const embed = patches.map((p, i) =>
    proj.map((w, d) => Math.tanh(w.reduce((s, v, j) => s + v * p[j], 0)) * 0.8 + 0.2 * Math.sin((i + 1) / (d + 1))),
  )

  // Each layer: patches attend to similar patches and mix in their vectors. Deeper layers = more context.
  let h = embed
  const mixPerLayer = 0.12
  for (let l = 0; l < layer; l++) {
    const att = h.map((q) => softmax(h.map((k) => q.reduce((s, v, d) => s + v * k[d], 0) * 1.5)))
    h = h.map((v, i) => v.map((x, d) => (1 - mixPerLayer) * x + mixPerLayer * h.reduce((s, k, j) => s + att[i][j] * k[d], 0)))
  }
  // Attention among the first 5 patches of the top row, at the chosen layer, for display.
  const row = h.slice(0, 5)
  // Centre the vectors so similarity reflects real differences, then use a sharp softmax for a readable pattern.
  const mean = Array.from({ length: D }, (_, d) => row.reduce((s, v) => s + v[d], 0) / row.length)
  const centred = row.map((v) => {
    const c = v.map((x, d) => x - mean[d])
    const n = Math.hypot(...c) || 1
    return c.map((x) => x / n)
  })
  // Cosine similarity between patches, sharpened by softmax: similar-looking patches attend to each other.
  const attShow = centred.map((q) => softmax(centred.map((k) => q.reduce((s, v, d) => s + v * k[d], 0) * 3)))

  const qTokens = question.replace('?', ' ?').replace('.', ' .').split(' ')
  const answer = ANSWERS[image][QUESTIONS.indexOf(question)]
  return { image, question, layer, px, patches, ink, embed, h, attShow, qTokens, answer }
}

function run(input: InputValues): FlowStep[] {
  const { image, layer, px, ink, embed, h, attShow, qTokens, answer } = compute(input)
  const brightest = ink.indexOf(Math.max(...ink))
  return [
    {
      from: 'image',
      to: 'patches',
      title: 'An image arrives with a question',
      caption: 'A vision-language model (VLM) such as GPT-4o, Gemini, Claude or LLaVA (2023) reads images as well as text. First the image must become something a language model can read.',
      parcel: { name: 'Image', fields: [{ k: 'size', v: '10 × 10 pixels (real: e.g. 336 × 336)' }, { k: 'shows', v: image }], visual: <Cells grid={px} size={14} /> },
      memory: { layers: [{ k: 'depth', v: `${LAYERS} layers` }] },
    },
    {
      from: 'patches',
      to: 'embed',
      title: `Cut into ${ink.length} patches`,
      caption: 'The image is cut into a grid of small squares, like words in a sentence. CLIP ViT-L/14 uses 14×14-pixel patches, so a 336×336 image gives 24×24 = 576 patches.',
      parcel: { name: 'Patches', fields: [{ k: 'patches', v: `${ink.length} (5 × 5)` }, { k: 'each patch', v: `${PATCH} × ${PATCH} pixels` }] },
    },
    {
      from: 'embed',
      to: 'layers',
      title: 'Vision tower, step 1: patch embedding',
      caption: 'The vision tower is the image half of the model. Its first layer flattens each patch and multiplies it by a learned matrix to get a vector, then adds a position embedding so the model knows where each patch sat.',
      parcel: {
        name: 'Patch embeddings',
        fields: [{ k: 'vectors', v: `${ink.length} × ${D} (real: 576 × 1,024)` }, { k: 'plus', v: 'a position embedding per patch' }],
        visual: (
          <div className="v-stack">
            <Vector label="patch 1" values={embed[0]} />
            <Vector label={`patch ${brightest + 1}`} values={embed[brightest]} />
          </div>
        ),
      },
    },
    {
      from: 'layers',
      to: 'features',
      title: `Vision tower, step 2: ${LAYERS} transformer layers`,
      caption: `Each layer runs self-attention across the patches, then a small feed-forward network, exactly like a language transformer. Patches swap information, so a patch of roof learns it belongs to a house. Slide “Use features from layer” to see the attention change with depth (now layer ${layer}).`,
      parcel: {
        name: `Attention at layer ${layer}`,
        fields: attShow.map((r, i) => {
          const others = r.map((v, j) => (j === i ? -1 : v))
          return { k: `patch ${i + 1}: strongest link`, v: `patch ${others.indexOf(Math.max(...others)) + 1}`, note: 'besides itself' }
        }),
        visual: <Heat rows={['p1', 'p2', 'p3', 'p4', 'p5']} cols={['1', '2', '3', '4', '5']} values={attShow} />,
      },
      memory: { layers: [{ k: 'depth', v: `${LAYERS} layers` }, { k: 'reading from', v: `layer ${layer}` }] },
    },
    {
      from: 'features',
      to: 'projector',
      title: 'Vision tower, step 3: take the patch features',
      caption: `The tower outputs one feature vector per patch. LLaVA takes them from the second-to-last layer (${LAYERS - 1}), which keeps more spatial detail than the very last layer, which CLIP training shaped for matching whole captions. The tower itself is usually kept frozen while the rest is trained.`,
      parcel: {
        name: 'Patch features',
        fields: [
          { k: 'from layer', v: `${layer} of ${LAYERS}` },
          { k: 'features', v: `${ink.length} vectors` },
          { k: 'patch 1', v: h[0].map((v) => fx(v, 1)).join(' ') },
        ],
      },
      memory: { features: [{ k: 'from layer', v: String(layer) }] },
    },
    {
      from: 'projector',
      to: 'llm',
      title: `${ink.length} image tokens`,
      caption: 'A small projector (in LLaVA-1.5, a two-layer MLP) maps each vision feature into the language model’s embedding space. To the LLM they now look like extra tokens: image tokens.',
      parcel: { name: 'Image tokens', fields: [{ k: 'tokens', v: `<img1> … <img${ink.length}>` }, { k: 'same size as', v: 'word embeddings' }] },
      memory: { projector: [{ k: 'image tokens', v: String(ink.length) }] },
    },
    {
      from: 'text',
      to: 'llm',
      title: 'The question joins as text tokens',
      caption: 'The question is tokenized as usual and placed after the image tokens, so attention can link words like “shape” to the right patches.',
      parcel: { name: 'Text tokens', fields: [{ k: 'tokens', v: qTokens.join(' | ') }] },
    },
    {
      from: 'llm',
      to: 'answer',
      title: 'The language model answers',
      caption: 'From here it is a normal transformer generating one token at a time, except some of its input came from pixels through the vision tower. The same idea extends to audio and video.',
      parcel: { name: 'Answer', fields: [{ k: 'reply', v: answer }] },
      memory: { answer: [{ k: 'reply', v: answer }] },
    },
  ]
}

function details(input: InputValues) {
  const { px, ink, embed, attShow, layer, qTokens, answer } = compute(input)
  const patchGrid = Array.from({ length: 5 }, (_, r) => ink.slice(r * 5, r * 5 + 5))
  return {
    image: <SdGrid grid={px} cell={14} />,
    patches: <SdGrid grid={patchGrid} cell={16} />,
    embed: <SdVectors rows={[{ label: 'patch 1', values: embed[0] }, { label: 'patch 2', values: embed[1] }]} cell={18} />,
    layers: (
      <>
        <SdHeat labels={['p1', 'p2', 'p3', 'p4', 'p5']} values={attShow} maxH={60} />
        <g transform="translate(112 0)">
          <SdText text="self-attention" y={12} />
          <SdText text="+ feed-forward" y={27} />
          <SdText text={`at layer ${layer}`} y={50} />
        </g>
      </>
    ),
    features: <SdText text={`${ink.length} vectors from layer ${layer}`} y={12} max={32} />,
    projector: (
      <>
        <SdText text="MLP →" y={12} />
        <SdText text={`${ink.length} tokens`} strong y={30} />
      </>
    ),
    text: <SdChips items={qTokens} width={196} />,
    llm: <SdText text={`${ink.length} image + ${qTokens.length} text tokens`} y={12} max={32} />,
    answer: <SdLines text={answer} max={30} lines={3} strong />,
  }
}

export const vlmMachine: Machine = {
  id: 'vision-language-model',
  era: 'transformers',
  year: 2023,
  name: 'Vision-language model',
  oneLiner: 'How models like GPT-4o and LLaVA pass an image through a vision tower into a language model.',
  groups: [
    { label: 'Image', x: 14, y: 40, w: 196, h: 412, tone: 'blue' },
    { label: 'Vision tower', x: 226, y: 40, w: 256, h: 412, tone: 'teal' },
    { label: 'Bridge', x: 498, y: 40, w: 134, h: 412, tone: 'purple' },
    { label: 'Language model', x: 648, y: 40, w: 238, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'image', name: 'Image', role: 'The picture you upload.', x: 112, y: 140, w: 176, h: 182, tone: 'blue', icon: 'image' },
    { id: 'patches', name: 'Patches', role: 'The image cut into a grid of small squares.', x: 112, y: 355, w: 176, h: 126, tone: 'blue', icon: 'grid' },
    { id: 'embed', name: 'Patch embedding', role: 'Turns each patch into a vector and adds its position.', x: 354, y: 115, w: 228, h: 76, tone: 'teal', icon: 'vector' },
    { id: 'layers', name: 'Transformer layers', role: 'Self-attention + feed-forward, repeated: patches share context.', x: 354, y: 245, w: 228, h: 104, tone: 'teal', icon: 'attention', stack: `× ${LAYERS} layers` },
    { id: 'features', name: 'Patch features', role: 'One output vector per patch, usually from the second-to-last layer.', x: 354, y: 385, w: 228, h: 58, tone: 'teal', icon: 'layers' },
    { id: 'projector', name: 'Projector', role: 'Maps vision features into the language model’s token space.', x: 565, y: 245, w: 120, h: 80, tone: 'purple', icon: 'route' },
    { id: 'text', name: 'Question', role: 'Your text, tokenized as usual.', x: 767, y: 110, w: 220, h: 80, tone: 'orange', icon: 'doc' },
    { id: 'llm', name: 'Language model', role: 'A normal LLM reading image tokens and text tokens together.', x: 767, y: 245, w: 220, h: 62, tone: 'green', icon: 'brain' },
    { id: 'answer', name: 'Answer', role: 'The generated reply.', x: 767, y: 370, w: 220, h: 86, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['image', 'patches'],
    ['patches', 'embed'],
    ['embed', 'layers'],
    ['layers', 'features'],
    ['features', 'projector'],
    ['projector', 'llm'],
    ['text', 'llm'],
    ['llm', 'answer'],
  ],
  inputs: [
    { key: 'image', label: 'Image', kind: 'select', options: Object.keys(ART) },
    { key: 'question', label: 'Question', kind: 'select', options: QUESTIONS },
    { key: 'layer', label: 'Use features from layer', kind: 'slider', min: 1, max: LAYERS },
  ],
  defaults: { image: 'a house', question: QUESTIONS[0], layer: LAYERS - 1 },
  run,
  details,
}
