import type { FlowStep, InputValues, Machine } from '../types'
import { SdChips, SdLines, SdText } from './details'

interface Scenario {
  server: string
  tools: string[]
  tool: string
  args: Record<string, string>
  source: string
  result: string
  answer: string
}
const SCENARIOS: Record<string, Scenario> = {
  'Summarise my notes about the launch': {
    server: 'Files server',
    tools: ['search_files', 'read_file', 'list_folder'],
    tool: 'search_files',
    args: { query: 'launch' },
    source: 'Your notes folder',
    result: 'launch.md: launch moved to 14 March; demo must be ready by Friday.',
    answer: 'Your notes say the launch moved to 14 March and the demo needs to be ready by Friday.',
  },
  'Open an issue: the login button is broken': {
    server: 'GitHub server',
    tools: ['create_issue', 'list_issues', 'search_code'],
    tool: 'create_issue',
    args: { repo: 'my-app', title: 'Login button is broken' },
    source: 'GitHub API',
    result: 'Issue #128 created in my-app.',
    answer: 'Done: I opened issue #128, “Login button is broken”, in my-app.',
  },
  'Will it rain in Paris tomorrow?': {
    server: 'Weather server',
    tools: ['get_forecast', 'get_alerts'],
    tool: 'get_forecast',
    args: { city: 'Paris', day: 'tomorrow' },
    source: 'Weather API',
    result: 'Light rain, 14 °C (sample data).',
    answer: 'Expect light rain in Paris tomorrow, around 14 °C. (This demo returns sample data.)',
  },
}

function compute(input: InputValues) {
  const key = (input.request as string) in SCENARIOS ? (input.request as string) : Object.keys(SCENARIOS)[0]
  return { key, s: SCENARIOS[key] }
}

function run(input: InputValues): FlowStep[] {
  const { key, s } = compute(input)
  const argText = Object.entries(s.args).map(([k, v]) => `"${k}": "${v}"`).join(', ')
  return [
    {
      from: 'user',
      to: 'host',
      title: 'You ask the assistant',
      caption: 'The Model Context Protocol (MCP), released by Anthropic in November 2024, is an open standard for plugging AI apps into tools and data, a bit like USB-C for AI.',
      parcel: { name: 'Request', fields: [{ k: 'you', v: key }] },
      memory: { host: [{ k: 'examples', v: 'Claude Desktop, IDEs, agents' }] },
    },
    {
      from: 'host',
      to: 'client',
      title: 'Connect and shake hands',
      caption: 'The host app runs one MCP client per server. On start-up each client sends initialize, and both sides agree on a protocol version and capabilities.',
      parcel: { name: 'initialize', fields: [{ k: 'method', v: 'initialize' }, { k: 'transport', v: 'stdio (local) or Streamable HTTP (remote)' }, { k: 'format', v: 'JSON-RPC 2.0' }] },
    },
    {
      from: 'client',
      to: 'server',
      title: 'Ask what tools exist',
      caption: 'The client calls tools/list. Servers can also offer resources (data to read) and prompts (reusable templates).',
      parcel: { name: 'tools/list', fields: [{ k: 'method', v: 'tools/list' }, { k: 'to', v: s.server }] },
    },
    {
      from: 'server',
      to: 'client',
      title: `${s.tools.length} tools offered`,
      caption: 'Each tool comes with a name, a plain-language description and a JSON schema for its inputs. The descriptions are what the model reads to decide when to use a tool.',
      parcel: { name: 'Tool list', fields: s.tools.map((t) => ({ k: t, v: 'name + description + input schema' })) },
      memory: { server: [{ k: 'tools', v: s.tools.join(', ') }] },
    },
    {
      from: 'client',
      to: 'host',
      title: 'The model picks a tool',
      caption: `The tool list is shown to the language model alongside your request. It decides ${s.tool} is the right tool and writes the arguments. Many hosts ask you to approve before it runs.`,
      parcel: { name: 'Model’s choice', fields: [{ k: 'tool', v: s.tool }, { k: 'arguments', v: `{ ${argText} }` }] },
    },
    {
      from: 'host',
      to: 'client',
      title: 'Send tools/call',
      caption: 'The host passes the call to the client, which sends a standard JSON-RPC request.',
      parcel: { name: 'tools/call', fields: [{ k: 'method', v: 'tools/call' }, { k: 'name', v: s.tool }, { k: 'arguments', v: `{ ${argText} }` }] },
    },
    {
      from: 'client',
      to: 'server',
      title: `Request reaches the ${s.server}`,
      caption: 'Any team can write a server once and every MCP-compatible app can use it; no custom integration per app.',
      parcel: { name: 'JSON-RPC request', fields: [{ k: 'id', v: '7' }, { k: 'method', v: 'tools/call' }] },
    },
    {
      from: 'server',
      to: 'source',
      title: 'The server does the real work',
      caption: `The server runs ordinary code against ${s.source}: reading files, calling an API, querying a database.`,
      parcel: { name: 'Work', fields: [{ k: 'calls', v: s.source }] },
    },
    {
      from: 'source',
      to: 'server',
      title: 'Data comes back',
      caption: 'The source responds and the server wraps the result as content (text, images or links) for the model.',
      parcel: { name: 'Result', fields: [{ k: 'content', v: s.result }] },
      memory: { source: [{ k: 'returned', v: s.result }] },
    },
    {
      from: 'server',
      to: 'client',
      title: 'Result returned',
      caption: 'The JSON-RPC response travels back with the same id, so the client knows which call it answers.',
      parcel: { name: 'JSON-RPC response', fields: [{ k: 'id', v: '7' }, { k: 'content', v: s.result }] },
    },
    {
      from: 'client',
      to: 'host',
      title: 'Into the model’s context',
      caption: 'The result is added to the conversation and the model writes its reply, or calls another tool if it needs more.',
      parcel: { name: 'Context', fields: [{ k: 'tool result', v: s.result }] },
    },
    {
      from: 'host',
      to: 'user',
      title: 'The answer',
      caption: 'One protocol, any number of tools: the same host can talk to file, GitHub, database and browser servers at once.',
      parcel: { name: 'Answer', fields: [{ k: 'assistant', v: s.answer }] },
      memory: { user: [{ k: 'got', v: s.answer }] },
    },
  ]
}

function details(input: InputValues) {
  const { key, s } = compute(input)
  return {
    user: <SdLines text={key} max={20} lines={3} strong />,
    host: (
      <>
        <SdText text="app + language model" y={12} />
        <SdText text="decides which tool to use" y={28} />
      </>
    ),
    client: (
      <>
        <SdText text="1 client per server" y={12} />
        <SdText text="speaks JSON-RPC 2.0" y={28} />
      </>
    ),
    server: (
      <>
        <SdText text={s.server} strong y={12} />
        <g transform="translate(0 22)">
          <SdChips items={s.tools} width={156} />
        </g>
      </>
    ),
    source: <SdLines text={s.result} max={22} lines={3} />,
  }
}

export const mcpMachine: Machine = {
  id: 'mcp',
  era: 'engineering',
  year: 2024,
  name: 'Model Context Protocol',
  oneLiner: 'MCP: one open standard that connects AI apps to any tool or data source.',
  groups: [
    { label: 'Host application', x: 14, y: 40, w: 440, h: 412, tone: 'blue' },
    { label: 'MCP server side', x: 470, y: 40, w: 416, h: 412, tone: 'orange' },
  ],
  stations: [
    { id: 'user', name: 'You', role: 'Asks the assistant for something.', x: 100, y: 240, w: 150, h: 100, tone: 'blue', icon: 'user' },
    { id: 'host', name: 'Host app + LLM', role: 'The AI app (e.g. Claude Desktop or an IDE) and its language model.', x: 320, y: 130, w: 200, h: 80, tone: 'purple', icon: 'brain' },
    { id: 'client', name: 'MCP client', role: 'Lives inside the host; keeps one connection to one server.', x: 320, y: 350, w: 200, h: 80, tone: 'teal', icon: 'route' },
    { id: 'server', name: 'MCP server', role: 'Exposes tools, resources and prompts over the protocol.', x: 590, y: 240, w: 190, h: 110, tone: 'orange', icon: 'tool' },
    { id: 'source', name: 'Data / API', role: 'The real system the server talks to.', x: 800, y: 240, w: 150, h: 110, tone: 'green', icon: 'db' },
  ],
  wires: [
    ['user', 'host'],
    ['host', 'client'],
    { from: 'client', to: 'server', label: 'JSON-RPC' },
    ['server', 'source'],
  ],
  inputs: [{ key: 'request', label: 'Ask the assistant', kind: 'select', options: Object.keys(SCENARIOS) }],
  defaults: { request: 'Summarise my notes about the launch' },
  run,
  details,
}
