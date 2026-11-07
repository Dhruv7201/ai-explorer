import type { FlowStep, InputValues, Machine } from '../types'
import { Bars } from './visuals'
import { SdBars, SdGrid, SdText } from './details'
import { rng } from './util'

const SIZES: Record<string, number> = { 'Small layer (1,024 wide)': 1024, 'Large layer (4,096 wide)': 4096, 'Huge layer (8,192 wide)': 8192 }
const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : String(n))

function compute(input: InputValues) {
  const label = (input.size as string) in SIZES ? (input.size as string) : Object.keys(SIZES)[1]
  const d = SIZES[label]
  const r = Number(input.rank ?? 8)
  const full = d * d
  const lora = 2 * d * r
  return { label, d, r, full, lora, share: lora / full }
}

function run(input: InputValues): FlowStep[] {
  const { d, r, full, lora, share } = compute(input)
  return [
    {
      from: 'base',
      to: 'lora',
      title: 'Freeze the pretrained model',
      caption: `Fine-tuning every weight of a big model is expensive. One ${d}×${d} layer alone has ${fmt(full)} numbers, and a large model has hundreds of such layers. LoRA (Hu et al., 2021) leaves all of them frozen.`,
      parcel: { name: 'Frozen layer W', fields: [{ k: 'shape', v: `${d} × ${d}` }, { k: 'weights', v: fmt(full) }, { k: 'trainable', v: 'no' }] },
      memory: { base: [{ k: 'weights', v: fmt(full) }] },
    },
    {
      from: 'lora',
      to: 'train',
      title: `Add two thin matrices (rank ${r})`,
      caption: `Beside the layer, LoRA adds A (${d}×${r}) and B (${r}×${d}). Their product B·A has the same shape as W but is built from far fewer numbers. B starts at zero, so the model is unchanged at first.`,
      parcel: { name: 'Adapters', fields: [{ k: 'A', v: `${d} × ${r}` }, { k: 'B', v: `${r} × ${d}` }, { k: 'new weights', v: fmt(lora) }] },
    },
    {
      from: 'data',
      to: 'train',
      title: 'Train on your examples',
      caption: 'Your dataset (for example, support replies in your company’s tone) flows through the model as usual, but gradients only update A and B.',
      parcel: { name: 'Training', fields: [{ k: 'trainable', v: `${fmt(lora)} (${(share * 100).toFixed(2)}%)` }, { k: 'frozen', v: fmt(full) }] },
      memory: { train: [{ k: 'trainable share', v: `${(share * 100).toFixed(2)}%` }] },
    },
    {
      from: 'train',
      to: 'merged',
      title: 'Merge: W + B·A',
      caption: `After training, B·A is added onto W, so there is no extra cost when the model runs. The adapter file is tiny (about ${fmt(lora * 2)} bytes per layer at 16-bit), so you can keep one per customer or task and swap them.`,
      parcel: {
        name: 'Weights to train',
        fields: [{ k: 'full fine-tune', v: fmt(full) }, { k: 'LoRA', v: fmt(lora) }],
        visual: <Bars items={[['full', full], ['LoRA', lora]]} highlight="LoRA" />,
      },
    },
    {
      from: 'merged',
      to: 'merged',
      title: `${(share * 100).toFixed(2)}% of the weights, most of the benefit`,
      caption: 'Raising the rank gives the adapter more capacity at the cost of size. QLoRA (2023) goes further by storing the frozen model in 4-bit, letting people fine-tune large models on a single GPU.',
      parcel: { name: 'Result', fields: [{ k: 'rank', v: String(r) }, { k: 'share trained', v: `${(share * 100).toFixed(2)}%` }] },
      memory: { merged: [{ k: 'extra cost at run time', v: 'none' }] },
    },
  ]
}

function details(input: InputValues) {
  const { r, full, lora, share } = compute(input)
  const rand = rng(3)
  const W = Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => 0.15 + rand() * 0.3))
  const rr = Math.min(r, 3)
  const A = Array.from({ length: 6 }, () => Array.from({ length: rr }, () => 0.5 + rand() * 0.5))
  const B = Array.from({ length: rr }, () => Array.from({ length: 6 }, () => 0.5 + rand() * 0.5))
  return {
    base: (
      <>
        <SdGrid grid={W} cell={14} />
        <g transform="translate(96 0)">
          <SdText text="frozen" strong y={12} />
          <SdText text={fmt(full)} y={28} />
        </g>
      </>
    ),
    lora: (
      <>
        <SdGrid grid={A} cell={10} />
        <g transform={`translate(${rr * 10 + 10} 0)`}>
          <SdGrid grid={B} cell={10} />
        </g>
        <SdText text={`A and B, rank ${r}`} y={74} />
      </>
    ),
    data: <SdText text="your examples" y={12} />,
    train: <SdBars items={[['trainable', share]]} width={126} max={1} format={(v) => `${(v * 100).toFixed(2)}%`} highlight="trainable" />,
    merged: (
      <>
        <SdText text="W + B·A" strong y={12} />
        <SdText text={`${fmt(lora)} new weights`} y={30} />
      </>
    ),
  }
}

export const loraMachine: Machine = {
  id: 'lora',
  era: 'engineering',
  year: 2021,
  name: 'LoRA fine-tuning',
  oneLiner: 'Customise a huge model by training two thin matrices instead of every weight.',
  groups: [
    { label: 'Pretrained model', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Add and train small adapters', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Result', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'base', name: 'Frozen weights W', role: 'A pretrained layer that is not changed.', x: 124, y: 230, w: 190, h: 126, tone: 'blue', icon: 'grid' },
    { id: 'lora', name: 'Adapters A and B', role: 'Two thin, trainable matrices added beside W.', x: 350, y: 130, w: 180, h: 120, tone: 'orange', icon: 'layers' },
    { id: 'data', name: 'Your examples', role: 'The data you want the model to learn from.', x: 350, y: 355, w: 180, h: 64, tone: 'teal', icon: 'db' },
    { id: 'train', name: 'Train A and B only', role: 'Gradients update the adapters; W stays frozen.', x: 558, y: 250, w: 150, h: 76, tone: 'purple', icon: 'gear' },
    { id: 'merged', name: 'Merged model', role: 'W + B·A: same speed as the original.', x: 771, y: 240, w: 200, h: 76, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['base', 'lora'],
    ['lora', 'train'],
    ['data', 'train'],
    ['train', 'merged'],
  ],
  inputs: [
    { key: 'size', label: 'Layer size', kind: 'select', options: Object.keys(SIZES) },
    { key: 'rank', label: 'Rank r', kind: 'slider', min: 1, max: 64 },
  ],
  defaults: { size: 'Large layer (4,096 wide)', rank: 8 },
  run,
  details,
}
