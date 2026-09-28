import { WG_TEAM } from '../services/presets'
import './WGAttendeesPicker.css'

// Chip multi-select for the "WG Attendees:" line. Selection order doesn't
// matter — output always follows the canonical WG_TEAM roster order.
export default function WGAttendeesPicker({ value = [], onChange }) {
  const toggle = (initials) => {
    const next = value.includes(initials)
      ? value.filter((v) => v !== initials)
      : WG_TEAM.filter((v) => value.includes(v) || v === initials)
    onChange(next)
  }

  return (
    <div className="wg-attendees">
      <div className="wg-attendees-header">
        <label className="wg-attendees-label">WG Attendees</label>
        {value.length > 0 && (
          <button type="button" className="wg-attendees-clear" onClick={() => onChange([])}>
            Clear
          </button>
        )}
      </div>
      <div className="wg-attendees-chips">
        {WG_TEAM.map((initials) => (
          <button
            key={initials}
            type="button"
            className={`wg-chip ${value.includes(initials) ? 'selected' : ''}`}
            aria-pressed={value.includes(initials)}
            onClick={() => toggle(initials)}
          >
            {initials}
          </button>
        ))}
      </div>
    </div>
  )
}
