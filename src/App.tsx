import { useEffect, useState } from 'react'
import { ERAS, MACHINES, findMachine } from './machines'
import { usePathRoute, useTheme } from './hooks'
import { applyMeta, pageMeta } from './seo'
import { Explorer } from './components/Explorer'
import type { Era } from './types'

export default function App({ initialPath }: { initialPath?: string } = {}) {
  const route = usePathRoute(initialPath)
  const [theme, toggleTheme] = useTheme()
  const found = findMachine(route[0] ?? '')
  const machine = found ?? MACHINES[0]
  // Only one era is expanded at a time, so the sidebar stays short.
  const [open, setOpen] = useState<Era | null>(machine.era)
  const [collapsed, setCollapsed] = useState(false)
  const [drawer, setDrawer] = useState(false)

  // Switch to the current machine's era when navigating.
  useEffect(() => {
    setOpen(machine.era)
    setDrawer(false)
  }, [machine.era, machine.id])

  // Keep the tab title, description and canonical URL in step with the page.
  useEffect(() => {
    applyMeta(pageMeta(found ?? null))
  }, [found])

  // Phone drawer: close on Escape, and stop the page behind it from scrolling.
  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false)
    document.addEventListener('keydown', onKey)
    document.documentElement.classList.add('no-scroll')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.documentElement.classList.remove('no-scroll')
    }
  }, [drawer])

  const toggleEra = (id: Era) => setOpen((cur) => (cur === id ? null : id))

  return (
    <div className={`app ${collapsed ? 'side-collapsed' : ''} ${drawer ? 'drawer-open' : ''}`}>
      <aside className="sidebar" aria-label="Topics">
        <div className="side-top">
          <a href="/" className="brand" aria-label="AI Explorer home">
            <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden>
              <rect x="0.5" y="0.5" width="31" height="31" rx="7" className="brand-frame" />
              <path d="M7 25 16 8 25 25M11 18.5h10" className="brand-letter" />
              <circle cx="16" cy="8" r="3.8" className="brand-node" />
            </svg>
            <span className="brand-text">AI Explorer</span>
          </a>
          <button className="icon-btn collapse-btn" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <svg viewBox="0 0 20 20"><path d={collapsed ? 'M8 5l5 5-5 5' : 'M12 5l-5 5 5 5'} /></svg>
          </button>
        </div>

        <nav className="topics">
          {ERAS.map((era) => {
            const list = MACHINES.filter((m) => m.era === era.id)
            const isOpen = open === era.id
            const count = list.length + era.upcoming.length
            return (
              <section key={era.id} className={`era era-${era.id} ${isOpen ? 'is-open' : ''}`}>
                <button
                  className="era-head"
                  onClick={() => {
                    if (collapsed) {
                      setCollapsed(false)
                      setOpen(era.id)
                    } else toggleEra(era.id)
                  }}
                  aria-expanded={isOpen}
                  title={era.name}
                >
                  <i className="era-mark" aria-hidden />
                  <span className="era-name">{era.name}</span>
                  <span className="era-count">{count}</span>
                  <svg className="chev" viewBox="0 0 20 20" aria-hidden><path d="M8 5l5 5-5 5" /></svg>
                </button>
                <div className="era-body">
                  <ul>
                    {list.map((m) => (
                      <li key={m.id}>
                        <a href={`/${m.id}`} className={m.id === machine.id ? 'is-current' : ''} aria-current={m.id === machine.id ? 'page' : undefined}>
                          <span>{m.name}</span>
                          <small>{m.year}</small>
                        </a>
                      </li>
                    ))}
                    {era.upcoming.map((u) => (
                      <li key={u.name}>
                        <span className="is-soon" title="Being built">
                          <span>{u.name}</span>
                          <small>soon</small>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )
          })}
        </nav>

        <div className="side-foot">
          <button className="theme-btn" onClick={toggleTheme}>
            <svg viewBox="0 0 20 20" aria-hidden>
              {theme === 'blueprint' ? <path d="M4 4h12v12H4z M4 10h12 M10 4v12" /> : <path d="M3 5h14M3 10h14M3 15h14" />}
            </svg>
            <span>{theme === 'blueprint' ? 'Switch to whiteprint' : 'Switch to blueprint'}</span>
          </button>
          <p className="credit">
            Inspired by{' '}
            <a href="https://protocol-explorer-alpha.vercel.app/" target="_blank" rel="noreferrer">
              Protocol Explorer
            </a>{' '}
            by Dilum Sanjaya
          </p>
        </div>
      </aside>

      <button className="drawer-scrim" onClick={() => setDrawer(false)} aria-label="Close topics" tabIndex={drawer ? 0 : -1} />

      <div className="content">
        <div className="mobile-bar">
          <button className="icon-btn" onClick={() => setDrawer(true)} aria-label="Open topics">
            <svg viewBox="0 0 20 20"><path d="M3 5h14M3 10h14M3 15h14" /></svg>
          </button>
          <span className="brand-text">AI Explorer</span>
        </div>
        <main>
          <Explorer key={machine.id} machine={machine} />
        </main>
        <footer className="footer">Toy numbers, real mechanisms: every value on screen is computed live from your input.</footer>
      </div>
    </div>
  )
}
