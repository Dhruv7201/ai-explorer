import type { Icon, Station } from '../types'

/** 16×16 line icons, drawn with the current stroke colour. */
const PATHS: Record<Icon, string> = {
  user: 'M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 14.5c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5',
  doc: 'M4 1.5h5.5L13 5v9.5H4zM9.5 1.5V5H13M6 8h5M6 10.5h5M6 13h3',
  tokens: 'M1.5 5h4v6h-4zM6.5 5h3.5v6H6.5zM11 5h3.5v6H11z',
  vector: 'M2 13V9M5 13V4M8 13V7M11 13V2.5M14 13V10M1 14.5h14',
  attention: 'M2 2h3v3H2zM6.5 2h3v3h-3zM11 2h3v3h-3zM2 6.5h3v3H2zM6.5 6.5h3v3h-3zM2 11h3v3H2z',
  layers: 'M8 1.5 14.5 5 8 8.5 1.5 5zM1.5 8 8 11.5 14.5 8M1.5 11 8 14.5 14.5 11',
  chart: 'M2 14.5h12M3 12h2V8H3zM7 12h2V4H7zM11 12h2V9.5h-2z',
  db: 'M2.5 3.5C2.5 2.4 5 1.5 8 1.5s5.5.9 5.5 2-2.5 2-5.5 2-5.5-.9-5.5-2zM2.5 3.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2',
  tool: 'M10.5 1.8a3.5 3.5 0 0 0-3.3 4.6L1.8 11.8a1.4 1.4 0 0 0 2 2l5.4-5.4a3.5 3.5 0 0 0 4.6-3.3l-2.1 2.1-2-.6-.6-2z',
  check: 'M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM5 8.2l2 2 4-4.2',
  noise: 'M2 2h2v2H2zM7 2h2v2H7zM12 2h2v2h-2zM4.5 5.5h2v2h-2zM9.5 5.5h2v2h-2zM2 9h2v2H2zM7 9h2v2H7zM12 9h2v2h-2zM4.5 12.5h2v2h-2zM9.5 12.5h2v2h-2z',
  image: 'M1.5 2.5h13v11h-13zM1.5 11l4-4 3 3 2-2 4 4M10.5 6a1 1 0 1 0 0-.1',
  rules: 'M5.5 3.5h9M5.5 8h9M5.5 12.5h9M1.5 2.5h2v2h-2zM1.5 7h2v2h-2zM1.5 11.5h2v2h-2z',
  brain: 'M6 2.5a2.5 2.5 0 0 0-2.4 3.2A2.5 2.5 0 0 0 3 10a2.5 2.5 0 0 0 3 3.3V2.5zM10 2.5a2.5 2.5 0 0 1 2.4 3.2A2.5 2.5 0 0 1 13 10a2.5 2.5 0 0 1-3 3.3V2.5z',
  search: 'M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM10.6 10.6l4 4',
  gear: 'M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4',
  grid: 'M1.5 1.5h13v13h-13zM1.5 6h13M1.5 10.5h13M6 1.5v13M10.5 1.5v13',
  route: 'M3 13.5a1.5 1.5 0 1 0 0-.1M13 2.5a1.5 1.5 0 1 0 0-.1M3 12V8.5C3 6 4.5 5 7 5h4.5M9.5 3l2 2-2 2',
  loop: 'M13.5 6A6 6 0 0 0 2.5 5M2.5 10a6 6 0 0 0 11 1M2.5 1.5V5H6M13.5 14.5V11H10',
}

export function IconGlyph({ icon, x, y, size = 16 }: { icon: Icon; x: number; y: number; size?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 16})`} className="icon-glyph">
      <path d={PATHS[icon]} />
    </g>
  )
}

/** Picks a sensible icon from a station's id or name when none is set. */
export function iconFor(s: Station): Icon {
  if (s.icon) return s.icon
  const n = `${s.id} ${s.name}`.toLowerCase()
  const rules: [RegExp, Icon][] = [
    [/\byou\b|user|human|rater|agent\b/, 'user'],
    [/token/, 'tokens'],
    [/embed|vector|feature|hidden|weights/, 'vector'],
    [/attention/, 'attention'],
    [/layer|stack|cell/, 'layers'],
    [/odds|prob|vote|score|sum|loss|reward|evaluat/, 'chart'],
    [/database|memory|examples|counts|real data|rule base|q-table|table/, 'db'],
    [/tool|calculator/, 'tool'],
    [/noise/, 'noise'],
    [/image|filter|board|map\b|world/, 'image'],
    [/rule|pattern|gate/, 'rules'],
    [/model|llm|network|generator|discriminator|neuron|denoiser|expert|engine|explorer/, 'brain'],
    [/search|retriev|scanner|frontier|ruler|distance/, 'search'],
    [/router|move|policy|swap|route|path/, 'route'],
    [/answer|label|reply|verdict|output|leaf|prediction|folder|best|sentiment|conclusion|image/, 'check'],
    [/prompt|text|question|email|message|fruit|input|word|doc/, 'doc'],
  ]
  return rules.find(([re]) => re.test(n))?.[1] ?? 'gear'
}
