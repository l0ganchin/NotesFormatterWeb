import { useState, useEffect } from 'react'
import { getUserProjects } from '../services/firebase'
import { PRESET_KEYS, CALL_TYPE_LABELS } from '../services/presets'
import './SavePresetAsModal.css'

// "Save As" for the current parameters: pick a destination project (new or
// existing) and which call-type slot to save them into. The actual write and
// state sync happen in App via onSave.
export default function SavePresetAsModal({
  isOpen,
  onClose,
  onSave,
  user,
  currentProjectId = null,
  defaultCallType = 'customer',
}) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [target, setTarget] = useState('new') // 'new' or a project id
  const [newProjectName, setNewProjectName] = useState('')
  const [callType, setCallType] = useState(defaultCallType)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  // Reset choices and fetch the project list every time the modal opens
  useEffect(() => {
    if (!isOpen || !user) return
    setCallType(defaultCallType)
    setTarget(currentProjectId || 'new')
    setNewProjectName('')
    setError('')
    setLoading(true)
    getUserProjects(user.uid)
      .then((list) => {
        list.sort((a, b) => {
          const aTime = a.updatedAt?.toMillis?.() || a.updatedAt?.seconds * 1000 || 0
          const bTime = b.updatedAt?.toMillis?.() || b.updatedAt?.seconds * 1000 || 0
          return bTime - aTime
        })
        setProjects(list)
      })
      .catch((err) => {
        console.error('Failed to load projects:', err)
        setError('Failed to load projects')
      })
      .finally(() => setLoading(false))
  }, [isOpen, user, currentProjectId, defaultCallType])

  if (!isOpen) return null

  const isNew = target === 'new'
  const canConfirm = !isSaving && !loading && (!isNew || newProjectName.trim())

  const handleConfirm = async () => {
    if (!canConfirm) return
    setIsSaving(true)
    setError('')
    try {
      await onSave({
        project: isNew ? null : projects.find((p) => p.id === target),
        newProjectName: isNew ? newProjectName.trim() : '',
        callType,
      })
      onClose()
    } catch (err) {
      console.error('Save As failed:', err)
      setError('Failed to save preset: ' + (err.message || 'unknown error'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="saveas-overlay" onClick={onClose}>
      <div className="saveas-modal" onClick={(e) => e.stopPropagation()}>
        <div className="saveas-header">
          <h3>Save Preset As</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="saveas-content">
          <label className="saveas-label">Save to</label>
          <div className="saveas-project-list">
            <button
              type="button"
              className={`saveas-project-option ${isNew ? 'selected' : ''}`}
              onClick={() => setTarget('new')}
            >
              + New project
            </button>
            {isNew && (
              <input
                type="text"
                className="saveas-name-input"
                placeholder="Project name..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirm()
                }}
              />
            )}
            {loading ? (
              <div className="saveas-loading">Loading projects...</div>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={`saveas-project-option ${target === project.id ? 'selected' : ''}`}
                  onClick={() => setTarget(project.id)}
                >
                  <span className="saveas-project-name">{project.name}</span>
                  {project.id === currentProjectId && <span className="saveas-current-tag">current</span>}
                </button>
              ))
            )}
          </div>

          <label className="saveas-label">As preset</label>
          <div className="saveas-type-pills">
            {PRESET_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={`saveas-type-pill ${callType === key ? 'active' : ''}`}
                onClick={() => setCallType(key)}
              >
                {CALL_TYPE_LABELS[key]}
              </button>
            ))}
          </div>
          {!isNew && (
            <p className="saveas-hint">
              This overwrites the selected project&apos;s {CALL_TYPE_LABELS[callType]} preset.
            </p>
          )}

          {error && <div className="saveas-error">{error}</div>}

          <div className="saveas-actions">
            <button type="button" className="saveas-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="saveas-confirm"
              onClick={handleConfirm}
              disabled={!canConfirm}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
