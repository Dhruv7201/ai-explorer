import type { Machine } from './types'

export const SITE_NAME = 'AI Explorer'
export const SITE_TAGLINE = 'How AI works, step by step'
export const SITE_DESCRIPTION =
  'Interactive, step-by-step visual explainers of how AI works, from ELIZA and search to neural networks, transformers, RAG and agents. Free, no sign-up.'

export interface PageMeta {
  path: string
  title: string
  description: string
}

/** Title and description for the home page (machine = null) or one machine's page. */
export function pageMeta(machine: Machine | null): PageMeta {
  if (!machine) return { path: '/', title: `${SITE_NAME}: ${SITE_TAGLINE}`, description: SITE_DESCRIPTION }
  const lead = machine.oneLiner.replace(/\s*[.:]?\s*$/, '')
  return {
    path: `/${machine.id}`,
    title: `${machine.name} explained visually, step by step | ${SITE_NAME}`,
    description: fit(`${lead}.`, [
      ' Interactive step-by-step explainer: change the input and watch it work live.',
      ' An interactive, step-by-step visual explainer.',
      ' Interactive and step by step.',
    ]),
  }
}

/** Keeps the browser tab and share tags in sync after in-app navigation. */
export function applyMeta(meta: PageMeta) {
  document.title = meta.title
  const set = (sel: string, value: string) => document.querySelector(sel)?.setAttribute('content', value)
  set('meta[name="description"]', meta.description)
  set('meta[property="og:title"]', meta.title)
  set('meta[property="og:description"]', meta.description)
  set('meta[name="twitter:title"]', meta.title)
  set('meta[name="twitter:description"]', meta.description)
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (canonical) {
    const url = new URL(meta.path, canonical.href).href
    canonical.href = url
    set('meta[property="og:url"]', url)
  }
}

/** Adds the longest suffix that keeps a description within what search results show (~155 characters). */
function fit(lead: string, suffixes: string[], max = 155) {
  const suffix = suffixes.find((x) => lead.length + x.length <= max) ?? ''
  if (lead.length + suffix.length <= max) return lead + suffix
  const cut = lead.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`
}
