import type { FlowStep, Machine } from '../types'
import type { InputValues } from '../types'
import { SdChips, SdGrid, SdText } from './details'
import { Cells } from './visuals'
import { rng } from './util'

// Original 10×10 pixel drawings used as the "image the model has learned to make".
export const ART: Record<string, string[]> = {
  'a house': ['....##....', '...####...', '..######..', '.########.', '##########', '.#......#.', '.#.##.#.#.', '.#.##...#.', '.#.##...#.', '.########.'],
  'a heart': ['..........', '.##....##.', '####..####', '##########', '##########', '.########.', '..######..', '...####...', '....##....', '..........'],
  'a tree': ['....##....', '...####...', '..######..', '.########.', '..######..', '.########.', '##########', '....##....', '....##....', '...####...'],
  'a smiley': ['..######..', '.#......#.', '#..#..#..#', '#..#..#..#', '#........#', '#.#....#.#', '#..#..#..#', '#...##...#', '.#......#.', '..######..'],
}

function run(input: Record<string, unknown>): FlowStep[] {
  const prompt = (input.prompt as string) in ART ? (input.prompt as string) : 'a house'
  const steps = Number(input.steps ?? 20)
  const seed = Number(input.seed ?? 1)
  const target = ART[prompt].map((r) => [...r].map((c) => (c === '#' ? 1 : 0)))
  const r = rng(seed * 7919)
  const noise = target.map((row) => row.map(() => r()))
  // Fewer denoising steps → a rougher final image.
  const quality = Math.min(1, 0.55 + steps / 40)
  const at = (frac: number) => {
    const a = frac * quality
    return target.map((row, i) => row.map((v, j) => Math.max(0, Math.min(1, a * v + (1 - a) * noise[i][j]))))
  }
  const snaps = [0.3, 0.6, 0.85]

  return [
    {
      from: 'prompt',
      to: 'textenc',
      title: `Prompt: "${prompt}"`,
      caption: 'Diffusion models (2020 onward) power image generators such as Stable Diffusion, Midjourney and DALL·E. They start from noise and remove it bit by bit.',
      parcel: { name: 'Prompt', fields: [{ k: 'text', v: prompt }] },
      memory: { scheduler: [{ k: 'denoising steps', v: String(steps) }] },
    },
    {
      from: 'textenc',
      to: 'unet',
      title: 'Encode the prompt',
      caption: 'A text encoder turns the prompt into vectors. They will steer every denoising step towards images that match the words.',
      parcel: { name: 'Text embedding', fields: [{ k: 'tokens', v: prompt.split(' ').join(' | ') }, { k: 'role', v: 'guides the denoiser' }] },
    },
    {
      from: 'noise',
      to: 'unet',
      title: 'Start from pure static',
      caption: `Generation begins with random noise. A different seed (now ${seed}) gives different static, and so a different final picture.`,
      parcel: { name: 'Random noise', fields: [{ k: 'seed', v: String(seed) }, { k: 'image', v: '100% noise' }], visual: <Cells grid={at(0)} size={15} /> },
    },
    ...snaps.map((f, i) => ({
      from: i % 2 === 0 ? 'unet' : 'scheduler',
      to: i % 2 === 0 ? 'scheduler' : 'unet',
      title: `Denoise: ${Math.round(f * 100)}% of the way`,
      caption:
        i === 0
          ? 'The denoiser network (often a U-Net) looks at the noisy image and predicts which part is noise. The scheduler removes a small slice of it.'
          : i === 1
            ? 'Rough shapes appear first; fine detail comes later. The prompt keeps nudging each step towards the description.'
            : 'Near the end, edges sharpen. Each step is a small correction, repeated many times.',
      parcel: {
        name: `Step ${Math.round(f * steps)} of ${steps}`,
        fields: [{ k: 'noise left', v: `${Math.round((1 - f * quality) * 100)}%` }],
        visual: <Cells grid={at(f)} size={15} />,
      },
    })),
    {
      from: 'unet',
      to: 'image',
      title: 'The finished image',
      caption:
        steps < 10
          ? 'With few steps the result stays noisy. More steps give cleaner images but take longer. Real models work in a compressed "latent" space and decode to full-size pixels at the end.'
          : 'After all the steps, the noise is gone and an image matching the prompt remains. Real models work in a compressed "latent" space and decode to full-size pixels at the end.',
      parcel: { name: 'Image', fields: [{ k: 'prompt', v: prompt }, { k: 'steps used', v: String(steps) }], visual: <Cells grid={at(1)} size={15} /> },
      memory: { image: [{ k: 'made', v: prompt }] },
    },
  ]
}

function details(input: InputValues) {
  const prompt = (input.prompt as string) in ART ? (input.prompt as string) : 'a house'
  const steps = Number(input.steps ?? 20)
  const seed = Number(input.seed ?? 1)
  const target = ART[prompt].map((r) => [...r].map((c) => (c === '#' ? 1 : 0)))
  const r = rng(seed * 7919)
  const noise = target.map((row) => row.map(() => r()))
  const quality = Math.min(1, 0.55 + steps / 40)
  const at = (frac: number) => target.map((row, i) => row.map((v, j) => Math.max(0, Math.min(1, frac * quality * v + (1 - frac * quality) * noise[i][j]))))
  return {
    prompt: <SdText text={`“${prompt}”`} strong y={12} />,
    textenc: <SdChips items={prompt.split(' ')} width={166} />,
    noise: <SdGrid grid={at(0)} cell={11} />,
    unet: (
      <>
        <SdText text="predicts the noise" y={12} />
        <SdText text={`${steps} steps`} y={28} />
      </>
    ),
    scheduler: <SdText text="removes a slice" y={12} />,
    image: <SdGrid grid={at(1)} cell={15} />,
  }
}

export const diffusionMachine: Machine = {
  id: 'diffusion',
  era: 'transformers',
  year: 2020,
  name: 'Diffusion',
  oneLiner: 'Generate an image by starting from noise and removing it step by step.',
  groups: [
    { label: 'Prompt', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Denoising loop', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Image', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'prompt', name: 'Prompt', role: 'Describes the image you want.', x: 124, y: 140, w: 190, h: 70, tone: 'blue', icon: 'doc' },
    { id: 'textenc', name: 'Text encoder', role: 'Turns the prompt into guidance vectors.', x: 124, y: 340, w: 190, h: 84, tone: 'blue', icon: 'tokens' },
    { id: 'noise', name: 'Noise', role: 'Random static: the starting canvas.', x: 350, y: 140, w: 180, h: 150, tone: 'teal', icon: 'noise' },
    { id: 'unet', name: 'Denoiser', role: 'Predicts the noise in the current image.', x: 350, y: 355, w: 180, h: 80, tone: 'purple', icon: 'brain', stack: '× every step' },
    { id: 'scheduler', name: 'Scheduler', role: 'Removes a little predicted noise each step.', x: 555, y: 250, w: 150, h: 66, tone: 'orange', icon: 'gear' },
    { id: 'image', name: 'Image', role: 'The final picture.', x: 771, y: 230, w: 200, h: 196, tone: 'green', icon: 'image' },
  ],
  wires: [
    ['prompt', 'textenc'],
    ['textenc', 'unet'],
    ['noise', 'unet'],
    ['unet', 'scheduler'],
    { from: 'unet', to: 'image', route: 'below' },
  ],
  inputs: [
    { key: 'prompt', label: 'Prompt', kind: 'select', options: Object.keys(ART) },
    { key: 'steps', label: 'Denoising steps', kind: 'slider', min: 2, max: 40, step: 2 },
    { key: 'seed', label: 'Seed', kind: 'slider', min: 1, max: 20 },
  ],
  defaults: { prompt: 'a house', steps: 20, seed: 1 },
  run,
  details,
}
