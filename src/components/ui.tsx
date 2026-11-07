import type { InputDef, InputValue } from '../types'

/** Renders one machine input. Everything here is "touchable", so it uses the lemon accent. */
export function InputControl({ def, value, onChange }: { def: InputDef; value: InputValue; onChange: (v: InputValue) => void }) {
  switch (def.kind) {
    case 'slider':
      return (
        <label className="control">
          <span className="control-label">
            {def.label}
            <output>
              {String(value)}
              {def.unit ? ` ${def.unit}` : ''}
            </output>
          </span>
          <input
            type="range"
            min={def.min}
            max={def.max}
            step={def.step ?? 1}
            value={Number(value)}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </label>
      )
    case 'toggle':
      return (
        <label className="control toggle">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          <span className="toggle-track" aria-hidden />
          <span className="control-label">{def.label}</span>
        </label>
      )
    case 'text':
      return (
        <label className="control wide">
          <span className="control-label">{def.label}</span>
          <input type="text" value={String(value)} maxLength={def.maxLength} onChange={(e) => onChange(e.target.value)} />
        </label>
      )
    case 'select':
      return (
        <div className="control" role="group" aria-label={def.label}>
          <span className="control-label">{def.label}</span>
          <div className="segmented">
            {def.options.map((o) => (
              <button key={o} type="button" aria-pressed={o === value} className={o === value ? 'is-on' : ''} onClick={() => onChange(o)}>
                {o}
              </button>
            ))}
          </div>
        </div>
      )
    case 'chips': {
      const set = value as string[]
      return (
        <div className="control wide" role="group" aria-label={def.label}>
          <span className="control-label">{def.label}</span>
          <div className="chips">
            {def.options.map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={set.includes(o)}
                className={`chip ${set.includes(o) ? 'is-on' : ''}`}
                onClick={() => onChange(set.includes(o) ? set.filter((x) => x !== o) : [...set, o])}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )
    }
  }
}
