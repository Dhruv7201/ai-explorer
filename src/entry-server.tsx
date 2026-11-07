// Build-time only: renders each page to HTML so search engines and link previews see real content.
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import App from './App.tsx'
import { MACHINES, ERAS } from './machines'
import { pageMeta, SITE_NAME, SITE_DESCRIPTION } from './seo'

export function render(path: string) {
  return renderToString(
    <StrictMode>
      <App initialPath={path} />
    </StrictMode>,
  )
}

export const pages = [
  { machine: null, ...pageMeta(null) },
  ...MACHINES.map((m) => ({ machine: { id: m.id, name: m.name, year: m.year, era: ERAS.find((e) => e.id === m.era)?.name ?? '' }, ...pageMeta(m) })),
]

export { SITE_NAME, SITE_DESCRIPTION }
