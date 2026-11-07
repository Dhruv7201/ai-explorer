import { useEffect, useMemo, useState } from 'react'
import type { Field, InputValues, Machine } from '../types'
import { InputControl } from './ui'
import { Diagram } from './Diagram'
import { LINKS } from '../machines/links'
import type { Link } from '../machines/links'

const STEP_MS = 3600

type Selection = { kind: 'parcel' } | { kind: 'station'; id: string }

export function Explorer({ machine }: { machine: Machine }) {
  const [input, setInput] = useState<InputValues>(machine.defaults)
  const steps = useMemo(() => machine.run(input), [machine, input])
  const details = useMemo(() => machine.details?.(input) ?? {}, [machine, input])
  const [rawIdx, setIdx] = useState(0)
  const idx = Math.min(rawIdx, steps.length - 1)
  const [playing, setPlaying] = useState(true)
  const [selection, setSelection] = useState<Selection>({ kind: 'parcel' })
  const step = steps[idx]

  useEffect(() => {
    if (!playing) return
    if (idx >= steps.length - 1) {
      setPlaying(false)
      return
    }
    const id = setTimeout(() => setIdx(idx + 1), STEP_MS)
    return () => clearTimeout(id)
  }, [playing, idx, steps.length])

  const go = (n: number) => {
    setIdx(Math.max(0, Math.min(steps.length - 1, n)))
    setSelection({ kind: 'parcel' })
  }
  const togglePlay = () => {
    if (!playing && idx >= steps.length - 1) setIdx(0)
    setPlaying((p) => !p)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return
      if (e.key === 'ArrowRight') go(idx + 1)
      else if (e.key === 'ArrowLeft') go(idx - 1)
      else if (e.key === ' ') {
        e.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // What each station holds after the current step.
  const memory = useMemo(() => {
    const m: Record<string, Field[]> = {}
    for (let i = 0; i <= idx; i++) Object.assign(m, steps[i].memory ?? {})
    return m
  }, [steps, idx])

  const byId = Object.fromEntries(machine.stations.map((s) => [s.id, s]))
  const selectedStation = selection.kind === 'station' ? byId[selection.id] : undefined
  const links = LINKS[machine.id]

  return (
    <div className="explorer">
      <section className="workbench">
        <header className="machine-head">
          <span className="drawing-no">{machine.year}</span>
          <h1>{machine.name}</h1>
          <p title={machine.oneLiner}>{machine.oneLiner}</p>
        </header>

        <div className="diagram">
          <Diagram
            machine={machine}
            steps={steps}
            step={step}
            stepKey={`${machine.id}-${idx}`}
            memory={memory}
            details={details}
            backdrop={machine.backdrop?.(input, idx)}
            selectedStation={selectedStation?.id}
            parcelSelected={selection.kind === 'parcel'}
            onSelectStation={(id) => setSelection({ kind: 'station', id })}
            onSelectParcel={() => setSelection({ kind: 'parcel' })}
          />
        </div>

        <p className="diagram-hint">
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 7 3 10l3 3M14 7l3 3-3 3M3 10h14" />
          </svg>
          Swipe the drawing sideways. Tap any box to see what it holds.
        </p>

        <div className="narration">
          <div className="transport">
            <button onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Previous step">
              <svg viewBox="0 0 20 20"><path d="M12.5 4 6.5 10l6 6" /></svg>
            </button>
            <button className="play" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? (
                <svg viewBox="0 0 20 20"><path d="M7 4v12M13 4v12" /></svg>
              ) : idx >= steps.length - 1 ? (
                <svg viewBox="0 0 20 20"><path d="M4 10a6 6 0 1 0 2-4.5M4 3v3.5h3.5" /></svg>
              ) : (
                <svg viewBox="0 0 20 20"><path d="M6 4l10 6-10 6z" className="fill" /></svg>
              )}
            </button>
            <button onClick={() => go(idx + 1)} disabled={idx === steps.length - 1} aria-label="Next step">
              <svg viewBox="0 0 20 20"><path d="M7.5 4l6 6-6 6" /></svg>
            </button>
          </div>
          <div className="story" aria-live="polite">
            <span className="step-count">
              Step {idx + 1} of {steps.length}
            </span>
            <h2 key={`${machine.id}-${idx}`}>{step.title}</h2>
            <p>{step.caption}</p>
          </div>
          <ol className="pips" aria-label="Steps">
            {steps.map((s, i) => (
              <li key={i}>
                <button
                  className={i === idx ? 'is-now' : i < idx ? 'is-past' : ''}
                  onClick={() => go(i)}
                  aria-label={`Step ${i + 1}: ${s.title}`}
                  title={s.title}
                >
                  {playing && i === idx && <span className="pip-fill" key={`${machine.id}-${idx}`} style={{ animationDuration: `${STEP_MS}ms` }} />}
                </button>
              </li>
            ))}
          </ol>
        </div>

        <section className="inputs" aria-label="Your input">
          <h3>Change the input</h3>
          <div className="inputs-grid">
            {machine.inputs.map((def) => (
              <InputControl key={def.key} def={def} value={input[def.key]} onChange={(v) => setInput((cur) => ({ ...cur, [def.key]: v }))} />
            ))}
          </div>
        </section>

        {/* The whole walkthrough as plain text: readable without the animation, and indexable by search engines. */}
        <details className="walkthrough">
          <summary>
            Read the whole walkthrough as text <span>{steps.length} steps</span>
          </summary>
          <h3>How {machine.name} works, step by step</h3>
          <ol className="walk-steps">
            {steps.map((s, i) => (
              <li key={i} className={i === idx ? 'is-now' : ''}>
                <button type="button" onClick={() => go(i)}>
                  {s.title}
                </button>
                <p>{s.caption}</p>
              </li>
            ))}
          </ol>
          <h3>The parts of the machine</h3>
          <dl className="walk-parts">
            {machine.stations.map((st) => (
              <div key={st.id}>
                <dt>{st.name}</dt>
                <dd>{st.role}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>

      <div className="side-col">
      <aside className="inspector" aria-live="polite">
        {selectedStation ? (
          <div className="ins-body" key={`st-${selectedStation.id}`}>
            <p className="ins-kind">Station</p>
            <h2>{selectedStation.name}</h2>
            <p className="ins-role">{selectedStation.role}</p>
            {memory[selectedStation.id]?.length ? (
              <FieldList fields={memory[selectedStation.id]} />
            ) : (
              <p className="ins-empty">Nothing has reached this station yet. Step forward to fill it.</p>
            )}
            {links?.parts[selectedStation.id] && (
              <p className="ins-learn">
                Learn more: <LinkOut link={links.parts[selectedStation.id]} />
              </p>
            )}
            <button className="ins-back" onClick={() => setSelection({ kind: 'parcel' })}>
              Show the moving parcel
            </button>
          </div>
        ) : (
          <div className="ins-body" key={`p-${machine.id}-${idx}`}>
            <p className="ins-kind">
              {step.from === step.to ? `Inside ${byId[step.from].name}` : `${byId[step.from].name} → ${byId[step.to].name}`}
            </p>
            <h2>{step.parcel.name}</h2>
            <FieldList fields={step.parcel.fields} />
            {step.parcel.visual && <div className="ins-visual">{step.parcel.visual}</div>}
            <p className="ins-hint">Click any station in the drawing to see what it holds right now.</p>
          </div>
        )}
      </aside>

      {links && (
        <section className="learn" aria-label="Learn more">
          <h3>Learn more</h3>
          <ul className="learn-main">
            {links.main.map((l) => (
              <li key={l.url}>
                <LinkOut link={l} />
              </li>
            ))}
          </ul>
          <h4>Each part of the machine</h4>
          <ul className="learn-parts">
            {machine.stations
              .filter((st) => links.parts[st.id])
              .map((st) => (
                <li key={st.id} className={selectedStation?.id === st.id ? 'is-selected' : ''}>
                  <button className="learn-part-name" onClick={() => setSelection({ kind: 'station', id: st.id })}>
                    {st.name}
                  </button>
                  <LinkOut link={links.parts[st.id]} />
                </li>
              ))}
          </ul>
        </section>
      )}
      </div>
    </div>
  )
}

/** External link that opens in a new tab and shows which site it goes to. */
function LinkOut({ link }: { link: Link }) {
  const host = new URL(link.url).hostname.replace(/^www\./, '').replace(/^en\./, '')
  return (
    <a className={`link-out ${host.includes('bytebytego') ? 'is-bbg' : ''}`} href={link.url} target="_blank" rel="noreferrer">
      <span className="link-title">{link.title}</span>
      <span className="link-host">{host}</span>
    </a>
  )
}

function FieldList({ fields }: { fields: Field[] }) {
  return (
    <dl className="fields">
      {fields.map((f, i) => (
        <div key={`${f.k}-${i}`} className="field">
          <dt>{f.k}</dt>
          <dd>
            {f.v}
            {f.note && <small>{f.note}</small>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
