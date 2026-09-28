import { PRESET_KEYS, CALL_TYPE_LABELS } from '../services/presets'
import './PresetPillNav.css'

// Top-of-panel navigator: one pill per call type (Management / Customer /
// Expert). The active pill selects which preset's parameters fill the form
// AND the "Type of Call" in the exported header. In project mode, Save
// persists the current parameters to the active pill's preset; Save As
// copies them into any call-type slot of a new or existing project.
export default function PresetPillNav({
  activeCallType,
  onChange,
  dirtyByType = {},
  isProjectMode = false,
  onSave,
  isSaving = false,
  justSaved = false,
  canSaveAs = false,
  onSaveAs,
}) {
  const activeDirty = !!dirtyByType[activeCallType]

  return (
    <div className="preset-pill-nav">
      <div className="preset-pills" role="tablist" aria-label="Call type preset">
        {PRESET_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeCallType === key}
            className={`preset-pill ${activeCallType === key ? 'active' : ''}`}
            onClick={() => onChange(key)}
          >
            {CALL_TYPE_LABELS[key]}
            {dirtyByType[key] && <span className="preset-dirty-dot" title="Unsaved changes" />}
          </button>
        ))}
      </div>

      <div className="preset-nav-actions">
        {isProjectMode && (
          <button
            type="button"
            className={`preset-save-btn ${justSaved && !activeDirty ? 'saved' : ''}`}
            onClick={onSave}
            disabled={isSaving || !activeDirty}
            title={activeDirty ? 'Save these parameters to this preset' : 'No unsaved changes'}
          >
            {justSaved && !activeDirty ? 'Saved ✓' : isSaving ? 'Saving...' : 'Save Template'}
          </button>
        )}
        {canSaveAs && (
          <button
            type="button"
            className="preset-saveas-btn"
            onClick={onSaveAs}
            title="Save these parameters into a new or existing project"
          >
            Save As…
          </button>
        )}
      </div>
    </div>
  )
}
