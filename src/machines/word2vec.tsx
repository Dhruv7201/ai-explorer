import type { FlowStep, Machine } from '../types'
import type { InputValues } from '../types'
import { SdBars, SdText, SdVectors } from './details'
import { Vector } from './visuals'
import { fx } from './util'

// Toy 6-d embeddings. Axes (unnamed in real models): royalty, male, capital city, French, Italian, swimming.
const AXES = ['royal', 'male', 'capital', 'french', 'italian', 'swim']
const V: Record<string, number[]> = {
  king: [0.95, 0.9, 0, 0, 0, 0],
  queen: [0.95, -0.9, 0, 0, 0, 0],
  man: [0.05, 0.9, 0, 0, 0, 0],
  woman: [0.05, -0.9, 0, 0, 0, 0],
  prince: [0.75, 0.85, 0, 0, 0, 0.05],
  princess: [0.75, -0.85, 0, 0, 0, 0.05],
  paris: [0.05, 0, 0.9, 0.9, 0, 0],
  rome: [0.1, 0, 0.9, 0, 0.9, 0],
  france: [0, 0, 0.1, 0.95, 0, 0],
  italy: [0, 0, 0.1, 0, 0.95, 0],
  pizza: [0, 0, 0, 0.05, 0.6, 0],
  fish: [0, 0, 0, 0, 0, 0.9],
  swimmer: [0, 0.1, 0, 0, 0, 0.95],
  runner: [0, 0.1, 0, 0, 0, 0.05],
  run: [0, 0, 0, 0, 0, 0],
  swim: [0, 0, 0, 0, 0, 0.85],
}
const ANALOGIES: Record<string, [string, string, string]> = {
  'king − man + woman': ['king', 'man', 'woman'],
  'paris − france + italy': ['paris', 'france', 'italy'],
  'runner − run + swim': ['runner', 'run', 'swim'],
  'prince − man + woman': ['prince', 'man', 'woman'],
}
const cos = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0) / ((Math.hypot(...a) * Math.hypot(...b)) || 1)

function run(input: Record<string, unknown>): FlowStep[] {
  const [a, b, c] = ANALOGIES[input.analogy as string] ?? ANALOGIES['king − man + woman']
  const result = V[a].map((v, i) => v - V[b][i] + V[c][i])
  const ranked = Object.entries(V)
    .filter(([w]) => ![a, b, c].includes(w))
    .map(([w, vec]) => [w, cos(result, vec)] as const)
    .sort((x, y) => y[1] - x[1])
  const best = ranked[0][0]

  return [
    {
      from: 'words',
      to: 'table',
      title: `Look up "${a}", "${b}", "${c}"`,
      caption: 'word2vec (2013) gives every word a list of numbers, a vector, learned by predicting which words appear near each other in billions of sentences.',
      parcel: { name: 'Words', fields: [{ k: 'start', v: a }, { k: 'subtract', v: b }, { k: 'add', v: c }] },
      memory: { table: [{ k: 'vocabulary', v: `${Object.keys(V).length} toy words` }, { k: 'dimensions', v: `${AXES.length} (real models: 300+)` }] },
    },
    {
      from: 'table',
      to: 'math',
      title: 'Words become vectors',
      caption: 'Words used in similar contexts end up with similar vectors. Real dimensions have no labels; we named ours so you can read them.',
      parcel: {
        name: 'Vectors',
        fields: AXES.map((ax, i) => ({ k: ax, v: `${fx(V[a][i])}  ${fx(V[b][i])}  ${fx(V[c][i])}` })),
        visual: (
          <div className="v-stack">
            <Vector label={a} values={V[a]} />
            <Vector label={b} values={V[b]} />
            <Vector label={c} values={V[c]} />
          </div>
        ),
      },
    },
    {
      from: 'math',
      to: 'search',
      title: `${a} − ${b} + ${c}`,
      caption: `Subtracting "${b}" removes that meaning, adding "${c}" puts a new one in. Meaning has become geometry.`,
      parcel: { name: 'Result vector', fields: AXES.map((ax, i) => ({ k: ax, v: fx(result[i]) })), visual: <Vector label="result" values={result} /> },
    },
    {
      from: 'search',
      to: 'answer',
      title: `Closest word: ${best}`,
      caption: 'Search the vocabulary for the vector pointing in the most similar direction (cosine similarity). This idea, words as vectors, is the first layer of every modern language model.',
      parcel: { name: 'Nearest words', fields: ranked.slice(0, 4).map(([w, s]) => ({ k: w, v: fx(s), note: 'cosine' })) },
      memory: { answer: [{ k: 'answer', v: best }] },
    },
  ]
}

function details(input: InputValues) {
  const name = (input.analogy as string) in ANALOGIES ? (input.analogy as string) : 'king − man + woman'
  const [a, b, c] = ANALOGIES[name]
  const result = V[a].map((v, i) => v - V[b][i] + V[c][i])
  const ranked = Object.entries(V)
    .filter(([w]) => ![a, b, c].includes(w))
    .map(([w, vec]) => [w, cos(result, vec)] as [string, number])
    .sort((x, y) => y[1] - x[1])
  return {
    words: <SdText text={name} strong y={12} />,
    table: <SdVectors rows={[a, b, c].map((w) => ({ label: w, values: V[w] }))} cell={14} />,
    math: <SdVectors rows={[{ label: 'result', values: result }]} cell={14} />,
    search: <SdBars items={ranked.slice(0, 3)} width={126} max={1} highlight={ranked[0][0]} format={(v) => fx(v)} />,
    answer: <SdText text={ranked[0][0]} strong y={14} />,
  }
}

export const word2vecMachine: Machine = {
  id: 'word2vec',
  era: 'neural',
  year: 2013,
  name: 'Word vectors',
  oneLiner: 'word2vec: turn words into numbers so that meaning becomes arithmetic.',
  groups: [
    { label: 'Words', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Vector space', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Answer', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'words', name: 'Words', role: 'The analogy you asked for.', x: 124, y: 240, w: 190, h: 70, tone: 'blue', icon: 'doc' },
    { id: 'table', name: 'Embedding table', role: 'One learned vector per word.', x: 350, y: 140, w: 180, h: 90, tone: 'teal', icon: 'db' },
    { id: 'math', name: 'Vector maths', role: 'Adds and subtracts the vectors.', x: 350, y: 350, w: 180, h: 64, tone: 'purple', icon: 'vector' },
    { id: 'search', name: 'Nearest search', role: 'Finds the word whose vector points the same way.', x: 555, y: 250, w: 150, h: 104, tone: 'orange', icon: 'search' },
    { id: 'answer', name: 'Answer', role: 'The word that completes the analogy.', x: 771, y: 250, w: 200, h: 76, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['words', 'table'],
    ['table', 'math'],
    ['math', 'search'],
    ['search', 'answer'],
  ],
  inputs: [{ key: 'analogy', label: 'Analogy', kind: 'select', options: Object.keys(ANALOGIES) }],
  defaults: { analogy: 'king − man + woman' },
  run,
  details,
}
