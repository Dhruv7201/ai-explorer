import type { ReactNode } from 'react'

export type Era = 'classic' | 'ml' | 'neural' | 'transformers' | 'engineering'

export type Tone = 'blue' | 'green' | 'orange' | 'purple' | 'pink' | 'teal'

export type Icon =
  | 'user' | 'doc' | 'tokens' | 'vector' | 'attention' | 'layers' | 'chart' | 'db' | 'tool'
  | 'check' | 'noise' | 'image' | 'rules' | 'brain' | 'search' | 'gear' | 'grid' | 'route' | 'loop'

export interface Station {
  id: string
  name: string
  /** One sentence: what this part of the machine does. */
  role: string
  /** Centre of the box, in the 900 × 460 drawing. */
  x: number
  y: number
  w?: number
  h?: number
  tone?: Tone
  icon?: Icon
  /** Draw as a stack of identical blocks, e.g. repeated layers. */
  stack?: string
}

/** A labelled container around related stations. */
export interface Group {
  label: string
  x: number
  y: number
  w: number
  h: number
  tone?: Tone
}

export type Wire = [string, string] | { from: string; to: string; label?: string; route?: 'above' | 'below' }

export interface Field {
  k: string
  v: string
  note?: string
}

/** The thing travelling along a wire at one step. */
export interface Parcel {
  name: string
  fields: Field[]
  visual?: ReactNode
}

export interface FlowStep {
  from: string
  to: string
  title: string
  caption: string
  parcel: Parcel
  /** What stations hold after this step; later steps override earlier ones. */
  memory?: Record<string, Field[]>
}

export type InputDef =
  | { key: string; label: string; kind: 'select'; options: string[] }
  | { key: string; label: string; kind: 'slider'; min: number; max: number; step?: number; unit?: string }
  | { key: string; label: string; kind: 'toggle' }
  | { key: string; label: string; kind: 'text'; maxLength?: number }
  | { key: string; label: string; kind: 'chips'; options: string[] }

export type InputValue = string | number | boolean | string[]
export type InputValues = Record<string, InputValue>

export interface Machine {
  id: string
  era: Era
  year: number
  name: string
  oneLiner: string
  stations: Station[]
  wires: Wire[]
  groups?: Group[]
  inputs: InputDef[]
  defaults: InputValues
  run: (input: InputValues) => FlowStep[]
  /** Live mini-visuals drawn inside stations (SVG, positioned from the box's top-left content area). */
  details?: (input: InputValues) => Partial<Record<string, ReactNode>>
  /** Custom artwork drawn under the stations (e.g. neurons and their connections), redrawn for every step. */
  backdrop?: (input: InputValues, step: number) => ReactNode
}
