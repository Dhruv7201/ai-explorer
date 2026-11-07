import { useEffect, useState } from 'react'

/** Minimal hash router: "#/perceptron" → ["perceptron"]. */
export function useHashRoute(): string[] {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onChange = () => {
      setRoute(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

type Theme = 'blueprint' | 'whiteprint'

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('ai-explorer-theme')
      if (saved === 'blueprint' || saved === 'whiteprint') return saved
    } catch {
      /* storage unavailable */
    }
    return 'blueprint'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('ai-explorer-theme', theme)
    } catch {
      /* storage unavailable */
    }
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'blueprint' ? 'whiteprint' : 'blueprint'))]
}
