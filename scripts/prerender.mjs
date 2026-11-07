// Runs after `vite build`: writes one real HTML page per topic, plus sitemap.xml, robots.txt and 404.html.
//
// Set SITE_URL (e.g. https://ai-explorer.example.workers.dev) as a build variable so canonical links,
// share previews and the sitemap use absolute URLs. Without it those are left out.
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const ssrDir = join(root, 'dist-ssr')
const site = (process.env.SITE_URL ?? '').replace(/\/+$/, '')

const { render, pages, SITE_NAME, SITE_DESCRIPTION } = await import(pathToFileURL(join(ssrDir, 'entry-server.js')).href)
const template = readFileSync(join(dist, 'index.html'), 'utf8')

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const abs = (path) => site + path
const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`

function head(page, { noindex = false } = {}) {
  const tags = [
    `<meta name="robots" content="${noindex ? 'noindex' : 'index, follow, max-image-preview:large'}" />`,
    `<meta property="og:type" content="${page.machine ? 'article' : 'website'}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
  ]
  if (site) {
    tags.push(
      `<link rel="canonical" href="${abs(page.path)}" />`,
      `<meta property="og:url" content="${abs(page.path)}" />`,
      `<meta property="og:image" content="${abs('/og.png')}" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta property="og:image:alt" content="AI Explorer: how AI works, step by step" />`,
      `<meta name="twitter:image" content="${abs('/og.png')}" />`,
    )
    if (noindex) return tags.join('\n    ')
    if (page.machine) {
      tags.push(
        jsonLd({
          '@context': 'https://schema.org',
          '@type': 'LearningResource',
          name: `${page.machine.name}, explained step by step`,
          headline: page.title,
          description: page.description,
          url: abs(page.path),
          image: abs('/og.png'),
          inLanguage: 'en',
          learningResourceType: 'Interactive simulation',
          interactivityType: 'active',
          isAccessibleForFree: true,
          educationalLevel: 'Beginner',
          about: { '@type': 'Thing', name: page.machine.name },
          isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: abs('/') },
        }),
        jsonLd({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: SITE_NAME, item: abs('/') },
            { '@type': 'ListItem', position: 2, name: page.machine.name, item: abs(page.path) },
          ],
        }),
      )
    } else {
      tags.push(
        jsonLd({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE_NAME,
          url: abs('/'),
          description: SITE_DESCRIPTION,
          inLanguage: 'en',
        }),
      )
    }
  }
  return tags.join('\n    ')
}

function page(p, opts) {
  return template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(p.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(p.description)}" />`)
    .replace('<!--seo-->', head(p, opts))
    .replace('<!--app-->', render(p.path))
}

for (const p of pages) {
  // "/perceptron" → dist/perceptron.html, which Cloudflare serves at /perceptron (no trailing slash).
  const file = p.path === '/' ? 'index.html' : `${p.path.slice(1)}.html`
  writeFileSync(join(dist, file), page(p))
}

const home = pages[0]
writeFileSync(join(dist, '404.html'), page({ ...home, title: `Page not found | ${SITE_NAME}` }, { noindex: true }))

const today = new Date().toISOString().slice(0, 10)
writeFileSync(
  join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\n${site ? `\nSitemap: ${abs('/sitemap.xml')}\n` : ''}`,
)
if (site) {
  writeFileSync(
    join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
      .map((p) => `  <url><loc>${abs(p.path)}</loc><lastmod>${today}</lastmod></url>`)
      .join('\n')}\n</urlset>\n`,
  )
} else {
  console.warn('prerender: SITE_URL is not set, so canonical links, share images and sitemap.xml were skipped.')
}

rmSync(ssrDir, { recursive: true, force: true })
console.log(`prerender: wrote ${pages.length} pages${site ? ` for ${site}` : ''}`)
