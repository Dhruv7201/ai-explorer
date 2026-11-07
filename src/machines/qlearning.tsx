import type { FlowStep, Machine } from '../types'
import type { InputValues } from '../types'
import { SdGrid, SdText } from './details'
import { fx, rng } from './util'

// 4×5 world: S start, G goal (+10), X pit (−10), # wall. Every move costs −1.
const WORLD = ['....G', '.#.X.', '.....', 'S..X.']
const ACTIONS = [[-1, 0, '↑'], [0, 1, '→'], [1, 0, '↓'], [0, -1, '←']] as const
const R = WORLD.length
const C = WORLD[0].length
type Q = number[][][] // [r][c][a]

function stepEnv(r: number, c: number, a: number) {
  const [dr, dc] = ACTIONS[a]
  let nr = r + dr
  let nc = c + dc
  if (nr < 0 || nc < 0 || nr >= R || nc >= C || WORLD[nr][nc] === '#') [nr, nc] = [r, c]
  const cell = WORLD[nr][nc]
  return { nr, nc, reward: cell === 'G' ? 10 : cell === 'X' ? -10 : -1, done: cell === 'G' || cell === 'X' }
}

function train(episodes: number, alpha: number, epsilon: number) {
  const q: Q = WORLD.map((row) => [...row].map(() => [0, 0, 0, 0]))
  const rand = rng(42)
  let reached = 0
  for (let e = 0; e < episodes; e++) {
    let [r, c] = [3, 0]
    for (let t = 0; t < 50; t++) {
      const a = rand() < epsilon ? Math.floor(rand() * 4) : q[r][c].indexOf(Math.max(...q[r][c]))
      const { nr, nc, reward, done } = stepEnv(r, c, a)
      const target = reward + (done ? 0 : 0.9 * Math.max(...q[nr][nc]))
      q[r][c][a] += alpha * (target - q[r][c][a])
      ;[r, c] = [nr, nc]
      if (done) {
        if (WORLD[r][c] === 'G' && e >= episodes - 20) reached++
        break
      }
    }
  }
  return { q, recentSuccess: Math.min(episodes, 20) ? reached / Math.min(episodes, 20) : 0 }
}

function PolicyView({ q, path }: { q: Q; path?: Set<string> }) {
  return (
    <div className="v-policy" style={{ gridTemplateColumns: `repeat(${C}, 30px)` }}>
      {WORLD.flatMap((row, r) =>
        [...row].map((ch, c) => {
          const best = q[r][c].indexOf(Math.max(...q[r][c]))
          const untouched = q[r][c].every((v) => v === 0)
          const cls = ch === '#' ? 'wall' : ch === 'G' ? 'goal' : ch === 'X' ? 'pit' : path?.has(`${r},${c}`) ? 'path' : ''
          return (
            <span key={`${r}${c}`} className={`v-policy-cell ${cls}`}>
              {ch === 'G' ? '★' : ch === 'X' ? '✕' : ch === '#' ? '' : untouched ? '·' : ACTIONS[best][2]}
            </span>
          )
        }),
      )}
    </div>
  )
}

function run(input: Record<string, unknown>): FlowStep[] {
  const episodes = Number(input.episodes ?? 50)
  const alpha = Number(input.alpha ?? 0.5)
  const epsilon = Number(input.epsilon ?? 0.2)
  const { q, recentSuccess } = train(episodes, alpha, epsilon)
  // One greedy demonstration step from the start square.
  const a = q[3][0].indexOf(Math.max(...q[3][0]))
  const { nr, nc, reward, done } = stepEnv(3, 0, a)
  const old = q[3][0][a]
  const target = reward + (done ? 0 : 0.9 * Math.max(...q[nr][nc]))
  // Greedy route from start.
  const path = new Set<string>()
  let [r, c] = [3, 0]
  for (let t = 0; t < 20 && WORLD[r][c] !== 'G' && WORLD[r][c] !== 'X'; t++) {
    path.add(`${r},${c}`)
    const s = stepEnv(r, c, q[r][c].indexOf(Math.max(...q[r][c])))
    ;[r, c] = [s.nr, s.nc]
  }
  const reaches = WORLD[r][c] === 'G'

  return [
    {
      from: 'agent',
      to: 'env',
      title: 'The agent picks a move',
      caption: `Reinforcement learning has no labelled answers, only rewards. With probability ε = ${epsilon} the agent explores at random; otherwise it takes the move it currently rates best.`,
      parcel: { name: 'Action', fields: [{ k: 'state', v: 'start square' }, { k: 'action', v: ACTIONS[a][2] }, { k: 'episodes of experience', v: String(episodes) }] },
      memory: { env: [{ k: 'goal', v: '+10' }, { k: 'pit', v: '−10' }, { k: 'each move', v: '−1' }] },
    },
    {
      from: 'env',
      to: 'reward',
      title: `Reward: ${reward}`,
      caption: 'The world answers with a new state and a reward. The agent never sees the map; it learns only from these numbers.',
      parcel: { name: 'Feedback', fields: [{ k: 'new square', v: `(${nr}, ${nc})` }, { k: 'reward', v: String(reward) }] },
    },
    {
      from: 'reward',
      to: 'qtable',
      title: 'Update the Q-table',
      caption: 'Q-learning (1989) keeps a score for every (square, move) pair: expected future reward. Each experience nudges one score toward reward + 0.9 × best score of the next square.',
      parcel: {
        name: 'Q update',
        fields: [
          { k: 'old Q', v: fx(old) },
          { k: 'target', v: fx(target) },
          { k: `new Q (α = ${alpha})`, v: fx(old + alpha * (target - old)) },
        ],
      },
      memory: { qtable: [{ k: 'entries', v: String(R * C * 4) }, { k: 'learning rate α', v: String(alpha) }] },
    },
    {
      from: 'qtable',
      to: 'policy',
      title: reaches ? 'A route to the star' : 'Still lost',
      caption: reaches
        ? 'Taking the highest-scoring arrow in each square gives the policy. Slide episodes down to 0 and watch it unlearn.'
        : 'Not enough experience yet. Add episodes or raise ε so it explores more.',
      parcel: {
        name: 'Learned policy',
        fields: [{ k: 'greedy route reaches goal', v: reaches ? 'yes' : 'no' }, { k: 'success in last 20 episodes', v: `${Math.round(recentSuccess * 100)}%` }],
        visual: <PolicyView q={q} path={path} />,
      },
      memory: { policy: [{ k: 'reaches goal', v: reaches ? 'yes' : 'no' }] },
    },
    {
      from: 'policy',
      to: 'agent',
      title: 'From grids to Go',
      caption: 'Replace the table with a neural network and you get DeepMind’s DQN (2013), which learned Atari games from pixels. AlphaGo (2016) combined it with search to beat Lee Sedol. The same reward idea later trained chatbots (RLHF).',
      parcel: { name: 'Milestones', fields: [{ k: '2013', v: 'DQN plays Atari' }, { k: '2016', v: 'AlphaGo beats Lee Sedol' }, { k: '2022', v: 'RLHF tunes ChatGPT' }] },
    },
  ]
}

function details(input: InputValues) {
  const episodes = Number(input.episodes ?? 50)
  const epsilon = Number(input.epsilon ?? 0.2)
  const { q, recentSuccess } = train(episodes, Number(input.alpha ?? 0.5), epsilon)
  const world = WORLD.map((row) => [...row].map((ch) => (ch === '#' ? 'wall' : ch === 'G' ? 'start' : ch === 'X' ? 'goal' : ch === 'S' ? 'path' : 'empty')))
  return {
    agent: (
      <>
        <SdText text={`${episodes} episodes`} y={12} />
        <SdText text={`explores ${Math.round(epsilon * 100)}% of moves`} y={28} />
      </>
    ),
    env: <SdGrid grid={world} cell={22} />,
    reward: <>{['+10 at the goal', '−10 in a pit', '−1 for each move'].map((t, i) => <SdText key={t} text={t} y={12 + i * 15} />)}</>,
    qtable: (
      <>
        <SdText text={`${R * C * 4} scores`} strong y={12} />
        <SdText text={`recent success ${Math.round(recentSuccess * 100)}%`} y={30} />
      </>
    ),
    policy: (
      <>
        {WORLD.flatMap((row, r) =>
          [...row].map((ch, c) => {
            const best = q[r][c].indexOf(Math.max(...q[r][c]))
            const untouched = q[r][c].every((v) => v === 0)
            const glyph = ch === 'G' ? '★' : ch === 'X' ? '✕' : ch === '#' ? '■' : untouched ? '·' : ACTIONS[best][2]
            return (
              <text key={`${r}${c}`} x={c * 22 + 10} y={r * 22 + 14} textAnchor="middle" className="sd-board" style={{ fontSize: 13 }}>
                {glyph}
              </text>
            )
          }),
        )}
      </>
    ),
  }
}

export const qlearningMachine: Machine = {
  id: 'q-learning',
  era: 'neural',
  year: 2013,
  name: 'Reinforcement learning',
  oneLiner: 'Learn by trial and error: try moves, collect rewards, remember what paid off.',
  groups: [
    { label: 'Act in the world', x: 14, y: 40, w: 460, h: 412, tone: 'blue' },
    { label: 'Learn from rewards', x: 490, y: 40, w: 396, h: 412, tone: 'orange' },
  ],
  stations: [
    { id: 'agent', name: 'Agent', role: 'Chooses moves; explores sometimes, exploits mostly.', x: 124, y: 240, w: 190, h: 84, tone: 'blue', icon: 'user' },
    { id: 'env', name: 'World', role: 'A grid with a goal, pits and walls the agent cannot see.', x: 360, y: 135, w: 190, h: 130, tone: 'teal', icon: 'image' },
    { id: 'policy', name: 'Policy', role: 'The best move in each square, read off the Q-table.', x: 360, y: 345, w: 190, h: 130, tone: 'purple', icon: 'route' },
    { id: 'reward', name: 'Reward', role: 'A number saying how good the last move was.', x: 690, y: 135, w: 190, h: 96, tone: 'orange', icon: 'chart' },
    { id: 'qtable', name: 'Q-table', role: 'Expected future reward for every square and move.', x: 690, y: 345, w: 190, h: 84, tone: 'pink', icon: 'db' },
  ],
  wires: [
    ['agent', 'env'],
    ['env', 'reward'],
    ['reward', 'qtable'],
    ['qtable', 'policy'],
    ['policy', 'agent'],
  ],
  inputs: [
    { key: 'episodes', label: 'Episodes of practice', kind: 'slider', min: 0, max: 300, step: 10 },
    { key: 'alpha', label: 'Learning rate α', kind: 'slider', min: 0.1, max: 1, step: 0.1 },
    { key: 'epsilon', label: 'Exploration ε', kind: 'slider', min: 0, max: 1, step: 0.05 },
  ],
  defaults: { episodes: 50, alpha: 0.5, epsilon: 0.2 },
  run,
  details,
}
