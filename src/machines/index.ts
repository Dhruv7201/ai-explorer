import type { Era, Machine } from '../types'
import { elizaMachine } from './eliza'
import { knnMachine } from './knn'
import { searchMachine } from './search'
import { expertMachine } from './expert'
import { treeMachine } from './tree'
import { minimaxMachine } from './minimax'
import { bayesMachine } from './bayes'
import { perceptronMachine } from './perceptron'
import { backpropMachine } from './backprop'
import { lstmMachine } from './lstm'
import { cnnMachine } from './cnn'
import { qlearningMachine } from './qlearning'
import { word2vecMachine } from './word2vec'
import { ganMachine } from './gan'
import { transformerMachine } from './transformer'
import { ragMachine } from './rag'
import { diffusionMachine } from './diffusion'
import { rlhfMachine } from './rlhf'
import { agentMachine } from './agent'
import { moeMachine } from './moe'
import { reasoningMachine } from './reasoning'
import { linregMachine } from './linreg'
import { logregMachine } from './logreg'
import { kmeansMachine } from './kmeans'
import { pcaMachine } from './pca'
import { svmMachine } from './svm'
import { forestMachine } from './forest'
import { evaluationMachine } from './evaluation'
import { attentionMachine } from './attention'
import { vlmMachine } from './vlm'
import { samplingMachine } from './sampling'
import { fewshotMachine } from './fewshot'
import { loraMachine } from './lora'
import { mcpMachine } from './mcp'
import { injectionMachine } from './injection'
import { jepaMachine } from './jepa'
import { nnBasicsMachine } from './nnbasics'

export const ERAS: { id: Era; name: string; upcoming: { year: number; name: string }[] }[] = [
  { id: 'classic', name: 'Classic AI', upcoming: [] },
  { id: 'ml', name: 'ML basics', upcoming: [] },
  { id: 'neural', name: 'Neural networks', upcoming: [] },
  { id: 'transformers', name: 'Transformers & LLMs', upcoming: [] },
  { id: 'engineering', name: 'AI engineering', upcoming: [] },
]

export const MACHINES: Machine[] = [
  elizaMachine,
  knnMachine,
  searchMachine,
  expertMachine,
  treeMachine,
  minimaxMachine,
  bayesMachine,
  perceptronMachine,
  backpropMachine,
  lstmMachine,
  cnnMachine,
  qlearningMachine,
  word2vecMachine,
  ganMachine,
  transformerMachine,
  ragMachine,
  diffusionMachine,
  rlhfMachine,
  agentMachine,
  moeMachine,
  reasoningMachine,
  linregMachine,
  logregMachine,
  kmeansMachine,
  pcaMachine,
  svmMachine,
  forestMachine,
  evaluationMachine,
  attentionMachine,
  vlmMachine,
  samplingMachine,
  fewshotMachine,
  loraMachine,
  mcpMachine,
  injectionMachine,
  jepaMachine,
  nnBasicsMachine,
].sort((a, b) => ERAS.findIndex((e) => e.id === a.era) - ERAS.findIndex((e) => e.id === b.era) || a.year - b.year)

export const findMachine = (id: string) => MACHINES.find((m) => m.id === id)
