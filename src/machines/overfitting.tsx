import type { FlowStep, InputValues, Machine } from '../types'
import type { PlotLine } from './details'
import { SdBars, SdPlot, SdText } from './details'
import { Bars } from './visuals'
import { fx, rng } from './util'

/** The hidden truth both data sets come from: a gentle curve plus noise. */
const truth = (x: number) => 5 + 2.4 * Math.sin(x * 0.62) + 0.08 * x
const sample = (seed: number, xs: number[]) => {
  const r = rng(seed)
  return xs.map((x) => ({ x, y: truth(x) + (r() - 0.5) * 2.2 }))
}
const TRAIN = sample(11, [0.6, 1.5, 2.3, 3.4, 4.1, 5.2, 6.0, 7.1, 8.0, 9.2])
const VALID = sample(29, [1.0, 1.9, 2.8, 3.8, 4.7, 5.6, 6.6, 7.6, 8.6, 9.6])

const LAMBDAS = ['0 (no penalty)', '0.0001', '0.001', '0.01', '0.1', '1']
const lambdaOf = (s: string) => (s.startsWith('0 ') ? 0 : Number(s))

/** x in 0..10 is rescaled to −1..1 so high powers stay well behaved. */
const feats = (x: number, d: number) => Array.from({ length: d + 1 }, (_, p) => ((x - 5) / 5) ** p)

/** Ridge regression: solve (XᵀX + λI)w = Xᵀy, without penalising the intercept. */
function fit(d: number, lambda: number) {
  const n = d + 1
  const A = Array.from({ length: n }, () => new Array<number>(n + 1).fill(0))
  for (const { x, y } of TRAIN) {
    const f = feats(x, d)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) A[i][j] += f[i] * f[j]
      A[i][n] += f[i] * y
    }
  }
  for (let i = 1; i < n; i++) A[i][i] += lambda * TRAIN.length
  // Gaussian elimination with partial pivoting.
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
    ;[A[c], A[p]] = [A[p], A[c]]
    const piv = A[c][c] || 1e-12
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const k = A[r][c] / piv
      for (let j = c; j <= n; j++) A[r][j] -= k * A[c][j]
    }
  }
  return A.map((row, i) => row[n] / (row[i] || 1e-12))
}

function compute(input: InputValues) {
  const degree = Number(input.degree ?? 3)
  const lamLabel = LAMBDAS.includes(String(input.lambda)) ? String(input.lambda) : LAMBDAS[0]
  const lambda = lambdaOf(lamLabel)
  const w = fit(degree, lambda)
  const predict = (x: number) => feats(x, degree).reduce((s, f, i) => s + f * w[i], 0)
  const err = (set: { x: number; y: number }[]) => set.reduce((s, p) => s + (p.y - predict(p.x)) ** 2, 0) / set.length
  const train = err(TRAIN)
  const valid = err(VALID)
  const size = Math.sqrt(w.slice(1).reduce((s, v) => s + v * v, 0))
  // High error even on the training data means too simple; a big jump on new data means it memorised noise.
  const verdict = train > 0.8 ? 'underfitting' : valid - train > 1 ? 'overfitting' : 'good fit'
  return { degree, lamLabel, lambda, w, predict, train, valid, size, verdict }
}

function curve(f: (x: number) => number): PlotLine[] {
  const out: PlotLine[] = []
  for (let x = 0; x < 10; x += 0.2) out.push({ x1: x, y1: f(x), x2: x + 0.2, y2: f(x + 0.2) })
  return out
}
const trainPts = TRAIN.map((p) => ({ ...p, cls: 'c0' }))
const validPts = VALID.map((p) => ({ ...p, cls: 'c1' }))

function run(input: InputValues): FlowStep[] {
  const { degree, lambda, w, train, valid, size, verdict } = compute(input)
  const gap = valid - train
  return [
    {
      from: 'train',
      to: 'fit',
      title: 'Ten noisy examples',
      caption: 'The model only gets to see these 10 training points. They follow a smooth trend, but every point is pushed up or down by noise that will not repeat.',
      parcel: { name: 'Training set', fields: TRAIN.slice(0, 5).map((p) => ({ k: `x = ${fx(p.x, 1)}`, v: `y = ${fx(p.y)}` })) },
      memory: { train: [{ k: 'points', v: String(TRAIN.length) }] },
    },
    {
      from: 'model',
      to: 'fit',
      title: `Choose how flexible the model is: degree ${degree}`,
      caption: `A degree-${degree} polynomial has ${degree + 1} adjustable weights. Degree 1 is a straight line and cannot bend. Degree 9 with 10 points can pass through every one of them, noise included.`,
      parcel: { name: 'Model', fields: [{ k: 'shape', v: degree === 1 ? 'straight line' : `degree-${degree} curve` }, { k: 'weights', v: String(degree + 1) }] },
      memory: { model: [{ k: 'weights', v: String(degree + 1) }] },
    },
    {
      from: 'penalty',
      to: 'fit',
      title: lambda ? `Penalise large weights (λ = ${lambda})` : 'No penalty yet',
      caption: lambda
        ? 'Regularisation adds the size of the weights to the error being minimised. Wild, wiggly curves need huge weights, so the penalty pushes the model toward smoother answers. This is ridge (L2) regression; neural networks use the same idea as weight decay, alongside dropout.'
        : 'With λ = 0 the model is free to use any weights at all. Try a high degree, then raise λ and watch the wiggles calm down.',
      parcel: { name: 'Penalty', fields: [{ k: 'λ', v: String(lambda) }, { k: 'weight size', v: fx(size) }] },
      memory: { penalty: [{ k: 'λ', v: String(lambda) }] },
    },
    {
      from: 'fit',
      to: 'validation',
      title: 'Fit, then test on points it never saw',
      caption: `Error on the training points is ${fx(train)}. But the real test is 10 fresh points from the same source: there the error is ${fx(valid)}. Training error alone always rewards more flexibility, so it cannot be trusted.`,
      parcel: {
        name: 'Errors',
        fields: [{ k: 'training error', v: fx(train) }, { k: 'validation error', v: fx(valid) }, { k: 'gap', v: fx(gap) }],
        visual: <Bars items={[['training', train], ['validation', valid]]} highlight="validation" />,
      },
      memory: { fit: [{ k: 'train error', v: fx(train) }], validation: [{ k: 'error', v: fx(valid) }] },
    },
    {
      from: 'validation',
      to: 'verdict',
      title: verdict === 'overfitting' ? 'Overfitting: it memorised the noise' : verdict === 'underfitting' ? 'Underfitting: too simple' : 'A good fit',
      caption:
        verdict === 'overfitting'
          ? 'The curve chases individual training points, so it does well on them and badly on new data. Fixes: a simpler model, more data, or a bigger λ.'
          : verdict === 'underfitting'
            ? 'The model is too stiff to follow the bend in the data, so even the training error is high. Allow more flexibility (a higher degree) or use a smaller λ.'
            : 'Both errors are low and close together: the model learned the trend, not the noise. In practice you pick degree and λ by trying several and keeping the lowest validation error.',
      parcel: { name: 'Verdict', fields: [{ k: 'diagnosis', v: verdict }, { k: 'degree', v: String(degree) }, { k: 'λ', v: String(lambda) }, { k: 'weights', v: w.slice(0, 4).map((v) => fx(v, 1)).join(', ') + (w.length > 4 ? ', …' : '') }] },
      memory: { verdict: [{ k: 'diagnosis', v: verdict }] },
    },
  ]
}

function details(input: InputValues) {
  const { degree, lambda, predict, train, valid, verdict, size } = compute(input)
  return {
    train: <SdPlot points={trainPts} w={166} h={70} />,
    model: <SdText text={degree === 1 ? 'straight line' : `degree ${degree}`} strong y={12} />,
    penalty: (
      <>
        <SdText text={`λ = ${lambda}`} strong y={12} />
        <SdText text={`weight size ${fx(size, 1)}`} y={30} />
      </>
    ),
    fit: <SdPlot points={trainPts} lines={curve(predict)} w={196} h={96} />,
    validation: <SdPlot points={validPts} lines={curve(predict)} w={126} h={70} />,
    verdict: (
      <>
        <SdText text={verdict} strong y={12} />
        <g transform="translate(0 22)">
          <SdBars items={[['train', train], ['valid', valid]]} width={176} format={(v) => fx(v)} />
        </g>
      </>
    ),
  }
}

export const overfittingMachine: Machine = {
  id: 'overfitting',
  era: 'ml',
  year: 1970,
  name: 'Overfitting & regularization',
  oneLiner: 'Why a model that aces its training data can fail on new data, and how a penalty fixes it.',
  groups: [
    { label: 'Inputs', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Training', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Check', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'train', name: 'Training data', role: 'The only examples the model learns from.', x: 124, y: 130, w: 190, h: 114, tone: 'blue', icon: 'db' },
    { id: 'model', name: 'Model capacity', role: 'How flexible the curve is allowed to be (polynomial degree).', x: 124, y: 340, w: 190, h: 70, tone: 'orange', icon: 'gear' },
    { id: 'penalty', name: 'Penalty (λ)', role: 'Regularisation: extra cost for large weights.', x: 350, y: 380, w: 180, h: 84, tone: 'pink', icon: 'rules' },
    { id: 'fit', name: 'Fit', role: 'Finds the weights with the lowest training error plus penalty.', x: 455, y: 170, w: 220, h: 140, tone: 'purple', icon: 'chart' },
    { id: 'validation', name: 'Validation data', role: 'Fresh points the model never trained on.', x: 771, y: 130, w: 150, h: 114, tone: 'teal', icon: 'search' },
    { id: 'verdict', name: 'Verdict', role: 'Compares training and validation error.', x: 771, y: 340, w: 200, h: 112, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['train', 'fit'],
    ['model', 'fit'],
    ['penalty', 'fit'],
    ['fit', 'validation'],
    ['validation', 'verdict'],
  ],
  inputs: [
    { key: 'degree', label: 'Polynomial degree', kind: 'slider', min: 1, max: 9 },
    { key: 'lambda', label: 'Penalty λ', kind: 'select', options: LAMBDAS },
  ],
  defaults: { degree: 9, lambda: LAMBDAS[0] },
  run,
  details,
}
