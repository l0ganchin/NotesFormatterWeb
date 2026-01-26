import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getPresets, savePreset, deletePreset } from '../services/firebase'
import './PresetManager.css'

function PresetManager({
  takeawaysGuidance,
  quantCategories,
  masterDocFile,
  onLoadPreset,
  onMasterDocChange
}) {
  const { user, isAuthenticated } = useAuth()
  const [presets, setPresets] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [error, setError] = useState('')

  // Load presets when user changes
  useEffect(() => {
    if (isAuthenticated && user) {
      loadPresets()
    } else {
      setPresets([])
    }
  }, [isAuthenticated, user])

  const loadPresets = async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const userPresets = await getPresets(user.uid)
      setPresets(userPresets)
    } catch (err) {
      console.error('Failed to load presets:', err)
      setError('Failed to load presets')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      setError('Please enter a preset name')
      return
    }
    if (!user) return

    setIsSaving(true)
    setError('')

    try {
      const preset = {
        id: presetName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
        name: presetName.trim(),
        takeawaysGuidance,
        quantCategories,
        masterDocFileName: masterDocFile?.name || null,
        createdAt: new Date().toISOString()
      }

      await savePreset(user.uid, preset)
      await loadPresets()
      setShowSaveDialog(false)
      setPresetName('')
    } catch (err) {
      console.error('Failed to save preset:', err)
      setError('Failed to save preset')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLoadPreset = (preset) => {
    onLoadPreset({
      takeawaysGuidance: preset.takeawaysGuidance || '',
      quantCategories: preset.quantCategories || []
    })
  }

  const handleDeletePreset = async (presetId, e) => {
    e.stopPropagation()
    if (!user) return
    if (!confirm('Delete this preset?')) return

    try {
      await deletePreset(user.uid, presetId)
      await loadPresets()
    } catch (err) {
      console.error('Failed to delete preset:', err)
      setError('Failed to delete preset')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="preset-manager">
        <div className="preset-section-header">
          <span className="preset-section-title">Project Presets</span>
        </div>
        <div className="preset-login-prompt">
          Sign in to save and load presets
        </div>
      </div>
    )
  }

  return (
    <div className="preset-manager">
      <div className="preset-section-header">
        <span className="preset-section-title">Project Presets</span>
        <button
          className="preset-save-btn"
          onClick={() => setShowSaveDialog(true)}
          title="Save current settings as preset"
        >
          + Save
        </button>
      </div>

      {/* Master Doc Upload */}
      <div className="master-doc-section">
        <label className="master-doc-label">
          Master Document (for appending)
        </label>
        <div className="master-doc-input">
          <input
            type="file"
            accept=".docx,.pdf"
            onChange={(e) => onMasterDocChange(e.target.files[0] || null)}
            id="master-doc-upload"
            className="master-doc-file-input"
          />
          <label htmlFor="master-doc-upload" className="master-doc-upload-btn">
            {masterDocFile ? masterDocFile.name : 'Choose file...'}
          </label>
          {masterDocFile && (
            <button
              className="master-doc-clear-btn"
              onClick={() => onMasterDocChange(null)}
              title="Clear master document"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Preset List */}
      {isLoading ? (
        <div className="preset-loading">Loading presets...</div>
      ) : presets.length > 0 ? (
        <div className="preset-list">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="preset-item"
              onClick={() => handleLoadPreset(preset)}
            >
              <div className="preset-item-info">
                <span className="preset-item-name">{preset.name}</span>
                {preset.masterDocFileName && (
                  <span className="preset-item-doc">{preset.masterDocFileName}</span>
                )}
              </div>
              <button
                className="preset-delete-btn"
                onClick={(e) => handleDeletePreset(preset.id, e)}
                title="Delete preset"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="preset-empty">No saved presets yet</div>
      )}

      {error && <div className="preset-error">{error}</div>}

      {/* Save Dialog */}
      {showSaveDialog && (
        <>
          <div className="preset-dialog-backdrop" onClick={() => setShowSaveDialog(false)} />
          <div className="preset-dialog">
            <div className="preset-dialog-header">Save Preset</div>
            <input
              type="text"
              className="preset-name-input"
              placeholder="Preset name (e.g., Project Alpha)"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              autoFocus
            />
            <div className="preset-dialog-info">
              This will save:
              <ul>
                <li>Key takeaways guidance</li>
                <li>Quant categories ({quantCategories.length})</li>
                {masterDocFile && <li>Master doc reference: {masterDocFile.name}</li>}
              </ul>
            </div>
            <div className="preset-dialog-actions">
              <button
                className="preset-dialog-cancel"
                onClick={() => setShowSaveDialog(false)}
              >
                Cancel
              </button>
              <button
                className="preset-dialog-save"
                onClick={handleSavePreset}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default PresetManager
