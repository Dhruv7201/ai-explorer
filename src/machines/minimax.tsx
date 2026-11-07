import type { FlowStep, Machine } from '../types'
import type { InputValues } from '../types'
import { SdBars, SdBoard, SdText } from './details'
import { Bars } from './visuals'

type Board = string[] // 9 cells: 'X' | 'O' | ''
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
const winner = (b: Board) => LINES.map(([a, c, d]) => (b[a] && b[a] === b[c] && b[a] === b[d] ? b[a] : '')).find(Boolean) ?? ''

const POSITIONS: Record<string, string> = {
  'X can win now': 'XX.OO....',
  'X must block': 'X..OO...X',
  'Early game': 'X...O....',
  'Empty board': '.........',
}
const parse = (s: string): Board => [...s].map((c) => (c === '.' ? '' : c))
const toMove = (b: Board) => (b.filter((c) => c === 'X').length <= b.filter((c) => c === 'O').length ? 'X' : 'O')

/** Plain minimax, counting every position visited. Scores are from X's view. */
function minimax(b: Board, player: string, stats: { nodes: number }, depth = 0): number {
  stats.nodes++
  const w = winner(b)
  if (w) return w === 'X' ? 10 - depth : depth - 10
  if (b.every(Boolean)) return 0
  const scores: number[] = []
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue
    b[i] = player
    scores.push(minimax(b, player === 'X' ? 'O' : 'X', stats, depth + 1))
    b[i] = ''
  }
  return player === 'X' ? Math.max(...scores) : Math.min(...scores)
}

function BoardView({ b, hl }: { b: Board; hl?: number }) {
  return (
    <div className="v-board">
      {b.map((c, i) => (
        <span key={i} className={`v-board-cell ${c ? `is-${c}` : ''} ${i === hl ? 'is-hl' : ''}`}>{c || (i === hl ? '•' : '')}</span>
      ))}
    </div>
  )
}

const cellName = (i: number) => `${['top', 'middle', 'bottom'][Math.floor(i / 3)]}-${['left', 'centre', 'right'][i % 3]}`

function run(input: Record<string, unknown>): FlowStep[] {
  const board = parse(POSITIONS[input.position as string] ?? POSITIONS['X can win now'])
  const me = toMove(board)
  const moves = board.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0)
  const stats = { nodes: 0 }
  const scored = moves.map((i) => {
    const b = [...board]
    b[i] = me
    const s = minimax(b, me === 'X' ? 'O' : 'X', stats, 1)
    return { i, s: me === 'X' ? s : -s }
  })
  const best = scored.reduce((a, b) => (b.s > a.s ? b : a), scored[0])
  const verdict = (s: number) => (s > 0 ? 'win' : s < 0 ? 'loss' : 'draw')

  return [
    {
      from: 'board',
      to: 'moves',
      title: `${me} to move`,
      caption: 'Game-playing AI turns a position into a search problem: try every move, then every reply, and so on.',
      parcel: { name: 'Position', fields: [{ k: 'to move', v: me }, { k: 'empty squares', v: String(moves.length) }], visual: <BoardView b={board} /> },
      memory: { board: [{ k: 'to move', v: me }] },
    },
    {
      from: 'moves',
      to: 'tree',
      title: `${moves.length} possible moves`,
      caption: 'Each legal move becomes a branch of the game tree. The tree grows explosively: each branch has its own branches.',
      parcel: { name: 'Legal moves', fields: moves.map((i) => ({ k: cellName(i), v: 'try it' })) },
    },
    {
      from: 'tree',
      to: 'score',
      title: `Searched ${stats.nodes.toLocaleString()} positions`,
      caption: 'Minimax plays both sides perfectly in its head: it assumes you pick your best move and the opponent picks theirs, all the way to the end.',
      parcel: { name: 'Search', fields: [{ k: 'positions visited', v: stats.nodes.toLocaleString() }, { k: 'assumption', v: 'both sides play perfectly' }] },
      memory: { tree: [{ k: 'positions visited', v: stats.nodes.toLocaleString() }] },
    },
    {
      from: 'score',
      to: 'best',
      title: 'Score every move',
      caption: 'Winning sooner scores higher, losing later scores less badly. Chess has far too many positions to reach the end, so Deep Blue stopped early and used a hand-tuned evaluation instead.',
      parcel: {
        name: 'Move scores',
        fields: scored.map((m) => ({ k: cellName(m.i), v: verdict(m.s), note: String(m.s) })),
        visual: <Bars items={scored.map((m) => [cellName(m.i), m.s + 10])} highlight={cellName(best.i)} />,
      },
    },
    {
      from: 'best',
      to: 'best',
      title: `Play ${cellName(best.i)}`,
      caption: `Best move leads to a ${verdict(best.s)} with perfect play. In 1997 IBM’s Deep Blue used this idea, searching ~200 million chess positions a second, to beat world champion Garry Kasparov.`,
      parcel: { name: 'Chosen move', fields: [{ k: 'square', v: cellName(best.i) }, { k: 'outcome', v: verdict(best.s) }], visual: <BoardView b={board} hl={best.i} /> },
      memory: { best: [{ k: 'move', v: cellName(best.i) }] },
    },
  ]
}

const SHORT = ['top-L', 'top', 'top-R', 'left', 'centre', 'right', 'bot-L', 'bottom', 'bot-R']

function details(input: InputValues) {
  const board = parse(POSITIONS[input.position as string] ?? POSITIONS['X can win now'])
  const me = toMove(board)
  const moves = board.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0)
  const stats = { nodes: 0 }
  const scored = moves.map((i) => {
    const b = [...board]
    b[i] = me
    const s = minimax(b, me === 'X' ? 'O' : 'X', stats, 1)
    return { i, s: me === 'X' ? s : -s }
  })
  const best = scored.reduce((a, b) => (b.s > a.s ? b : a), scored[0])
  const top = [...scored].sort((a, b) => b.s - a.s).slice(0, 5)
  return {
    board: <SdBoard cells={board} />,
    moves: (
      <>
        <SdText text={`${moves.length} legal moves`} strong y={12} />
        <SdText text={`${me} to move`} y={30} />
      </>
    ),
    tree: (
      <>
        <SdText text={`${stats.nodes.toLocaleString()} positions`} strong y={12} />
        <SdText text="both sides play perfectly" y={30} />
      </>
    ),
    score: <SdBars items={top.map((m) => [SHORT[m.i], m.s + 10] as [string, number])} width={126} max={20} highlight={SHORT[best.i]} format={(v) => String(v - 10)} />,
    best: (
      <>
        <SdBoard cells={board} hl={best.i} />
        <g transform="translate(100 0)">
          <SdText text={SHORT[best.i]} strong y={14} />
          <SdText text={best.s > 0 ? 'wins' : best.s < 0 ? 'loses' : 'draws'} y={32} />
        </g>
      </>
    ),
  }
}

export const minimaxMachine: Machine = {
  id: 'game-tree',
  era: 'classic',
  year: 1997,
  name: 'Game-tree search',
  oneLiner: 'Minimax: look ahead through every move and reply, as Deep Blue did in chess.',
  groups: [
    { label: 'Position', x: 14, y: 40, w: 220, h: 412, tone: 'blue' },
    { label: 'Look ahead', x: 250, y: 40, w: 390, h: 412, tone: 'purple' },
    { label: 'Decide', x: 656, y: 40, w: 230, h: 412, tone: 'green' },
  ],
  stations: [
    { id: 'board', name: 'Board', role: 'The current game position.', x: 124, y: 230, w: 190, h: 136, tone: 'blue', icon: 'image' },
    { id: 'moves', name: 'Move generator', role: 'Lists every legal move.', x: 350, y: 140, w: 180, h: 84, tone: 'teal', icon: 'route' },
    { id: 'tree', name: 'Game tree', role: 'Explores moves, replies, replies to replies…', x: 350, y: 350, w: 180, h: 84, tone: 'purple', icon: 'layers', stack: '× every reply' },
    { id: 'score', name: 'Evaluator', role: 'Scores final positions: win, loss or draw.', x: 555, y: 250, w: 150, h: 150, tone: 'orange', icon: 'chart' },
    { id: 'best', name: 'Best move', role: 'The move with the best guaranteed outcome.', x: 771, y: 230, w: 200, h: 136, tone: 'green', icon: 'check' },
  ],
  wires: [
    ['board', 'moves'],
    ['moves', 'tree'],
    ['tree', 'score'],
    ['score', 'best'],
  ],
  inputs: [{ key: 'position', label: 'Position (tic-tac-toe)', kind: 'select', options: Object.keys(POSITIONS) }],
  defaults: { position: 'X must block' },
  run,
  details,
}
