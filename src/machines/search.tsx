import type { FlowStep, InputValues, Machine } from '../types'
import { SdBars, SdGrid, SdText } from './details'
import { Bars, Cells } from './visuals'

const MAPS: Record<string, string[]> = {
  'Open field': [
    'S..........',
    '...........',
    '....###....',
    '....#......',
    '....#......',
    '..........G',
  ],
  Maze: [
    'S..#.......',
    '.#.#.#####.',
    '.#...#...#.',
    '.#####.#.#.',
    '.......#..G',
    '####.###.##',
  ],
  'U-shaped trap': [
    'S..........',
    '...........',
    '..#######..',
    '........#..',
    '..#######..',
    '..........G',
  ],
}
const ALGOS = ['Breadth-first', 'Depth-first', 'A*'] as const
type Algo = (typeof ALGOS)[number]
type Cell = [number, number]
const k = ([r, c]: Cell) => `${r},${c}`

interface Result {
  order: Cell[]
  g: Map<string, number>
  frontierAt: number[]
  path: string[]
  found: boolean
}

function solve(map: string[], algo: Algo): Result {
  const R = map.length
  const C = map[0].length
  const find = (ch: string): Cell => {
    const r = map.findIndex((row) => row.includes(ch))
    return [r, map[r].indexOf(ch)]
  }
  const S = find('S')
  const G = find('G')
  const h = ([r, c]: Cell) => (algo === 'A*' ? Math.abs(r - G[0]) + Math.abs(c - G[1]) : 0)
  const g = new Map([[k(S), 0]])
  const parent = new Map<string, string>()
  const open: { cell: Cell; pri: number; seq: number }[] = [{ cell: S, pri: 0, seq: 0 }]
  const done = new Set<string>()
  const order: Cell[] = []
  const frontierAt: number[] = []
  let seq = 0
  while (open.length) {
    if (algo === 'Depth-first') open.sort((a, b) => b.seq - a.seq)
    else open.sort((a, b) => a.pri - b.pri || a.seq - b.seq)
    const { cell } = open.shift()!
    if (done.has(k(cell))) continue
    done.add(k(cell))
    order.push(cell)
    frontierAt.push(open.length)
    if (k(cell) === k(G)) break
    const [r, c] = cell
    for (const n of [[r - 1, c], [r, c + 1], [r + 1, c], [r, c - 1]] as Cell[]) {
      if (n[0] < 0 || n[1] < 0 || n[0] >= R || n[1] >= C || map[n[0]][n[1]] === '#' || done.has(k(n))) continue
      const ng = g.get(k(cell))! + 1
      if (algo === 'Depth-first' || !g.has(k(n)) || ng < g.get(k(n))!) {
        g.set(k(n), ng)
        parent.set(k(n), k(cell))
        open.push({ cell: n, pri: ng + h(n), seq: ++seq })
      }
    }
  }
  const found = done.has(k(G))
  const path: string[] = []
  if (found) for (let x: string | undefined = k(G); x; x = parent.get(x)) path.unshift(x)
  return { order, g, frontierAt, path, found }
}

function snapshot(map: string[], res: Result, upto: number, showPath = false) {
  const seen = new Set(res.order.slice(0, upto).map(k))
  const path = new Set(showPath ? res.path : [])
  return map.map((row, r) =>
    [...row].map((ch, c) => {
      const key = `${r},${c}`
      if (ch === '#') return 'wall'
      if (ch === 'S') return 'start'
      if (ch === 'G') return 'goal'
      if (path.has(key)) return 'path'
      if (seen.has(key)) return 'seen'
      return 'empty'
    }),
  )
}

function run(input: Record<string, unknown>): FlowStep[] {
  const map = MAPS[input.map as string] ?? MAPS['Open field']
  const algo = (input.algorithm as Algo) ?? 'A*'
  const res = solve(map, algo)
  const n = res.order.length
  const open = map.join('').replace(/#/g, '').length
  const how: Record<Algo, string> = {
    'Breadth-first': 'always expands the square closest to the start, rippling outward evenly.',
    'Depth-first': 'always expands the newest square, diving down one corridor until it hits a wall.',
    'A*': 'expands the square with the lowest (steps so far + guessed distance left).',
  }
  const steps: FlowStep[] = [
    {
      from: 'map',
      to: 'frontier',
      title: 'Put the start on the frontier',
      caption: `The map has ${open} open squares. The frontier is the list of squares discovered but not yet explored; it begins with just S.`,
      parcel: { name: 'Start square', fields: [{ k: 'square', v: 'S' }, { k: 'algorithm', v: algo }], visual: <Cells grid={snapshot(map, res, 0)} /> },
      memory: {
        map: [{ k: 'size', v: `${map.length} × ${map[0].length}` }, { k: 'open squares', v: String(open) }],
        heuristic: [{ k: 'used?', v: algo === 'A*' ? 'yes: |Δrow| + |Δcol| to G' : 'no' }],
      },
    },
  ]
  for (let i = 1; i <= Math.min(3, n); i++) {
    const cell = res.order[i - 1]
    steps.push({
      from: 'frontier',
      to: 'expand',
      title: `Explore square ${i}`,
      caption: `${algo} ${how[algo]}`,
      parcel: {
        name: `Square (${cell[0]}, ${cell[1]})`,
        fields: [
          { k: 'steps from start', v: String(res.g.get(k(cell)) ?? 0) },
          { k: 'frontier size', v: String(res.frontierAt[i - 1]) },
        ],
        visual: <Cells grid={snapshot(map, res, i)} />,
      },
      memory: { frontier: [{ k: "waiting", v: `${res.frontierAt[i - 1]} square${res.frontierAt[i - 1] === 1 ? "" : "s"}` }], expand: [{ k: 'explored', v: String(i) }] },
    })
    if (i === 2 && algo === 'A*') {
      const [r, c] = cell
      const gr = map.findIndex((row) => row.includes('G'))
      const dist = Math.abs(r - gr) + Math.abs(c - map[gr].indexOf('G'))
      steps.push({
        from: 'expand',
        to: 'heuristic',
        title: 'Ask the heuristic for a hint',
        caption: 'A* asks a cheap rule of thumb how far each new square probably is from G. It ignores walls, so it never overestimates; that keeps A*’s path optimal.',
        parcel: { name: 'Distance guess', fields: [{ k: 'square', v: `(${r}, ${c})` }, { k: 'guessed distance to G', v: String(dist) }] },
      })
    }
  }
  const mid = Math.max(4, Math.floor(n * 0.6))
  if (n > mid) {
    steps.push({
      from: 'expand',
      to: 'frontier',
      title: 'Keep going',
      caption: 'Each explored square adds its open neighbours to the frontier. The loop repeats until G comes off the frontier.',
      parcel: { name: `After ${mid} squares`, fields: [{ k: 'explored', v: String(mid) }, { k: 'frontier size', v: String(res.frontierAt[mid - 1]) }], visual: <Cells grid={snapshot(map, res, mid)} /> },
      memory: { expand: [{ k: 'explored', v: String(mid) }] },
    })
  }
  steps.push({
    from: 'frontier',
    to: 'path',
    title: res.found ? 'Goal reached' : 'No way through',
    caption: res.found
      ? `G is reached after exploring ${n} squares. Following each square's parent back to S gives a ${res.path.length - 1}-step path.${algo === 'Depth-first' ? ' Depth-first found a path, but not the shortest.' : ''}`
      : 'The frontier ran empty before reaching G.',
    parcel: {
      name: 'Path',
      fields: [{ k: 'explored', v: String(n) }, { k: 'path length', v: res.found ? `${res.path.length - 1} steps` : 'none' }],
      visual: <Cells grid={snapshot(map, res, n, true)} />,
    },
    memory: { path: [{ k: 'length', v: res.found ? `${res.path.length - 1} steps` : 'none' }, { k: 'explored', v: String(n) }] },
  })
  const all = ALGOS.map((a) => [a, solve(map, a)] as const)
  const fewest = all.reduce((x, y) => (y[1].order.length < x[1].order.length ? y : x))
  const shortest = Math.min(...all.filter(([, r]) => r.found).map(([, r]) => r.path.length))
  steps.push({
    from: 'path',
    to: 'path',
    title: 'Compare the three strategies',
    caption:
      fewest[0] === 'A*'
        ? 'Same map, three strategies. The hint lets A* skip much of the map and still find a shortest path. Guided search like this later powered game engines such as Deep Blue (1997).'
        : `On this map ${fewest[0]} got lucky and explored the fewest squares${fewest[1].path.length > shortest ? ', but its path is longer than the best one' : ''}. A* only promises the shortest path with reasonable effort; in a twisty maze the straight-line hint can mislead it.`,
    parcel: {
      name: 'Squares explored',
      fields: all.map(([a, r]) => ({ k: a, v: `${r.order.length} explored, ${r.path.length - 1}-step path` })),
      visual: <Bars items={all.map(([a, r]) => [a, r.order.length])} highlight={algo} />,
    },
  })
  return steps
}

function details(input: InputValues) {
  const map = MAPS[input.map as string] ?? MAPS['Open field']
  const algo = (input.algorithm as Algo) ?? 'A*'
  const res = solve(map, algo)
  const SHORT: Record<Algo, string> = { 'Breadth-first': 'BFS', 'Depth-first': 'DFS', 'A*': 'A*' }
  const all = ALGOS.map((a) => [SHORT[a], solve(map, a).order.length] as [string, number])
  const open = map.join('').replace(/#/g, '').length
  const rule: Record<Algo, string> = {
    'Breadth-first': 'closest to start first',
    'Depth-first': 'newest square first',
    'A*': 'lowest steps + guess first',
  }
  return {
    map: <SdGrid grid={snapshot(map, res, 0)} cell={15} />,
    frontier: (
      <>
        <SdText text={algo} strong y={12} />
        <SdText text={rule[algo]} y={30} />
        <SdText text={`peak size: ${Math.max(...res.frontierAt)} squares`} y={48} />
      </>
    ),
    expand: <SdBars items={[['explored', res.order.length], ['open', open]]} width={146} max={open} />,
    heuristic: (
      <>
        <SdText text={algo === 'A*' ? '|Δrow| + |Δcol| to G' : 'not used'} strong y={12} />
        <SdText text={algo === 'A*' ? 'never overestimates' : 'switch to A* to use it'} y={30} />
      </>
    ),
    path: (
      <>
        <SdGrid grid={snapshot(map, res, res.order.length, true)} cell={14} />
        <g transform="translate(0 92)">
          <SdBars items={all} width={166} highlight={SHORT[algo]} />
        </g>
      </>
    ),
  }
}

export const searchMachine: Machine = {
  id: 'search',
  era: 'classic',
  year: 1968,
  name: 'A* search',
  oneLiner: 'Solve a problem by exploring possibilities, guided by a smart guess.',
  groups: [
    { label: 'The problem', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Search loop', x: 250, y: 40, w: 400, h: 412, tone: 'teal' },
    { label: 'Result', x: 666, y: 40, w: 220, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'map', name: 'Map', role: 'The problem: squares, walls, a start and a goal.', x: 124, y: 222, w: 190, h: 150, tone: 'blue', icon: 'image' },
    { id: 'frontier', name: 'Frontier', role: 'Squares found but not yet explored, in priority order.', x: 352, y: 150, w: 180, h: 100, tone: 'teal', icon: 'db' },
    { id: 'expand', name: 'Explorer', role: 'Takes the best square off the frontier and looks at its neighbours.', x: 352, y: 352, w: 180, h: 96, tone: 'teal', icon: 'search' },
    { id: 'heuristic', name: 'Heuristic', role: 'A cheap guess of the distance left to the goal.', x: 558, y: 352, w: 160, h: 96, tone: 'purple', icon: 'gear' },
    { id: 'path', name: 'Path', role: 'The route traced back from the goal to the start.', x: 776, y: 230, w: 190, h: 220, tone: 'green', icon: 'route' },
  ],
  wires: [
    ['map', 'frontier'],
    { from: 'frontier', to: 'expand', label: 'pop best' },
    ['expand', 'heuristic'],
    ['frontier', 'path'],
  ],
  inputs: [
    { key: 'algorithm', label: 'Strategy', kind: 'select', options: [...ALGOS] },
    { key: 'map', label: 'Map', kind: 'select', options: Object.keys(MAPS) },
  ],
  defaults: { algorithm: 'A*', map: 'Maze' },
  run,
  details,
}
