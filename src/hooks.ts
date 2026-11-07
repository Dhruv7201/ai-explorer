import { useEffect, useState } from 'react'

const parse = (path: string) => path.split('/').filter(Boolean)

/** Moves to an in-app path without a page load. */
export function navigate(path: string) {
  if (path === window.location.pathname) return
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/**
 * Minimal path router: "/perceptron" → ["perceptron"].
 * `initialPath` is used when prerendering, where there is no window.
 * Same-origin <a href="/..."> clicks are handled here, so links stay plain links for crawlers.
 */
export function usePathRoute(initialPath?: string): string[] {
  const [route, setRoute] = useState(() => parse(initialPath ?? window.location.pathname))
  useEffect(() => {
    const onPop = () => {
      setRoute(parse(window.location.pathname))
      window.scrollTo(0, 0)
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element).closest?.('a')
      if (!a || a.target || a.hasAttribute('download')) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin) return
      e.preventDefault()
      navigate(url.pathname)
    }
    window.addEventListener('popstate', onPop)
    document.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('popstate', onPop)
      document.removeEventListener('click', onClick)
    }
  }, [])
  return route
}

type Theme = 'blueprint' | 'whiteprint'

const THEME_KEY = 'ai-explorer-theme'

/** The theme is first applied by an inline script in index.html (no flash); React picks it up after hydration. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>('blueprint')
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = document.documentElement.dataset.theme
    if (t === 'blueprint' || t === 'whiteprint') setTheme(t)
    setReady(true)
  }, [])
  useEffect(() => {
    if (!ready) return
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'blueprint' ? '#0b3d91' : '#f5f8fd')
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* storage unavailable */
    }
  }, [theme, ready])
  return [theme, () => setTheme((t) => (t === 'blueprint' ? 'whiteprint' : 'blueprint'))]
}
