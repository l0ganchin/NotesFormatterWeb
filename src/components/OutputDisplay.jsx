import { useState, useEffect } from 'react'
import FormattedPreview from './FormattedPreview'
import { uploadFormattedNote, getProjectFiles, appendToMasterDoc, createMasterDoc } from '../services/fileStorage'
import { Document, Packer } from 'docx'
import { parseMarkdownToDocx, DEFAULT_CONFIG } from '../services/export'
import './OutputDisplay.css'

const LOADING_MESSAGES = [
  'Reading through the transcript...',
  'Identifying key themes and insights...',
  'Synthesizing discussion points...',
  'Crafting executive-level takeaways...',
  'Formatting quantitative scores...',
  'Polishing the final output...',
  'Almost there...',
]

function sanitizeFilename(str) {
  if (!str || !str.trim()) return 'Unknown'
  return str.trim().replace(/[/\\?%*:|"<>]/g, '_')
}

export default function OutputDisplay({
  content,
  isLoading,
  onExportWord,
  takeawayBullet = '\u2022',
  discussionBullet = '\u2022',
  currentProject,
  user,
  respondentInfo = {},
  transcript,
  notes
}) {
  const [viewMode, setViewMode] = useState('preview') // 'preview' or 'raw'
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [messageIndex, setMessageIndex] = useState(0)
  const [savingNote, setSavingNote] = useState(false)
  const [savedNote, setSavedNote] = useState(false)

  // Master doc picker state
  const [showMasterPicker, setShowMasterPicker] = useState(false)
  const [masterDocs, setMasterDocs] = useState([])
  const [loadingMasters, setLoadingMasters] = useState(false)
  const [selectedMasterId, setSelectedMasterId] = useState(null)
  const [appendingToMaster, setAppendingToMaster] = useState(false)
  const [appendedToMaster, setAppendedToMaster] = useState(false)
  const [showCreateMaster, setShowCreateMaster] = useState(false)
  const [newMasterName, setNewMasterName] = useState('')

  // Timer effect
  useEffect(() => {
    if (!isLoading) {
      setElapsedSeconds(0)
      setMessageIndex(0)
      return
    }

    const timerInterval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(timerInterval)
  }, [isLoading])

  // Rotate messages every 4 seconds
  useEffect(() => {
    if (!isLoading) return

    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
    }, 4000)

    return () => clearInterval(messageInterval)
  }, [isLoading])

  // Reset saved states when content changes
  useEffect(() => {
    setSavedNote(false)
    setAppendedToMaster(false)
    setShowMasterPicker(false)
    setSelectedMasterId(null)
    setShowCreateMaster(false)
    setNewMasterName('')
  }, [content])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}m ${secs}s`
    }
    return `${secs}s`
  }

  const buildNoteBlob = async () => {
    const config = {
      ...DEFAULT_CONFIG,
      takeaway_bullet: { ...DEFAULT_CONFIG.takeaway_bullet, bullet: takeawayBullet || '\u2022' },
      discussion_bullet: { ...DEFAULT_CONFIG.discussion_bullet, bullet: discussionBullet || '\u2022' },
      quant_bullet: { ...DEFAULT_CONFIG.quant_bullet, bullet: discussionBullet || '\u2022' },
    }
    const paragraphs = parseMarkdownToDocx(content, config, true)
    const doc = new Document({ sections: [{ children: paragraphs }] })
    return await Packer.toBlob(doc)
  }

  const handleShowMasterPicker = async () => {
    setShowMasterPicker(true)
    setLoadingMasters(true)
    try {
      const docs = await getProjectFiles(currentProject.id, 'masterDocs')
      setMasterDocs(docs)
      if (docs.length === 0) {
        setShowCreateMaster(true)
      }
    } catch (err) {
      console.error('Failed to load master docs:', err)
    } finally {
      setLoadingMasters(false)
    }
  }

  const handleAppendToMaster = async () => {
    if (!selectedMasterId || !user || !currentProject) return
    setAppendingToMaster(true)
    try {
      const noteBlob = await buildNoteBlob()
      await appendToMasterDoc(currentProject.id, selectedMasterId, noteBlob, user.uid)
      setAppendedToMaster(true)
      setShowMasterPicker(false)
    } catch (err) {
      console.error('Append to master failed:', err)
      alert('Failed to append to master document: ' + err.message)
    } finally {
      setAppendingToMaster(false)
    }
  }

  const handleCreateFirstMaster = async () => {
    if (!newMasterName.trim() || !user || !currentProject) return
    setAppendingToMaster(true)
    try {
      const noteBlob = await buildNoteBlob()
      await createMasterDoc(currentProject.id, newMasterName.trim(), noteBlob, {
        createdBy: user.uid,
        createdByName: user.displayName || ''
      })
      setAppendedToMaster(true)
      setShowMasterPicker(false)
      setShowCreateMaster(false)
      setNewMasterName('')
    } catch (err) {
      console.error('Create master failed:', err)
      alert('Failed to create master document: ' + err.message)
    } finally {
      setAppendingToMaster(false)
    }
  }

  const handleSaveNote = async () => {
    if (!currentProject || !user || !content) return
    setSavingNote(true)
    try {
      const paragraphs = parseMarkdownToDocx(content)
      const doc = new Document({
        sections: [{ children: paragraphs }]
      })
      const blob = await Packer.toBlob(doc)

      const name = sanitizeFilename(respondentInfo.name)
      const role = sanitizeFilename(respondentInfo.role)
      const company = sanitizeFilename(respondentInfo.company)
      const date = new Date().toISOString().slice(0, 10)
      const fileName = `${name}_${role}_${company}_Notes_${date}.docx`

      await uploadFormattedNote(currentProject.id, blob, {
        fileName,
        respondentName: respondentInfo.name || '',
        respondentRole: respondentInfo.role || '',
        respondentCompany: respondentInfo.company || '',
        createdBy: user.uid,
        createdByName: user.displayName || ''
      })
      setSavedNote(true)
    } catch (err) {
      console.error('Failed to save note:', err)
      alert('Failed to save note: ' + err.message)
    } finally {
      setSavingNote(false)
    }
  }

  if (isLoading && !content) {
    // Show spinner only when no content has arrived yet
    return (
      <div className="output-display">
        <div className="output-header">
          <h2>Formatted Output</h2>
        </div>
        <div className="output-content loading">
          <div className="spinner"></div>
          <div className="loading-info">
            <p className="loading-status">{LOADING_MESSAGES[messageIndex]}</p>
            <p className="loading-timer">{formatTime(elapsedSeconds)} elapsed</p>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading && content) {
    // Show streaming content with loading indicator
    return (
      <div className="output-display">
        <div className="output-header">
          <h2>Formatted Output</h2>
          <div className="streaming-indicator">
            <div className="spinner-small"></div>
            <span>{formatTime(elapsedSeconds)}</span>
          </div>
        </div>
        <div className="output-content preview-mode streaming">
          <FormattedPreview content={content} takeawayBullet={takeawayBullet} discussionBullet={discussionBullet} />
        </div>
      </div>
    )
  }

  if (!content) {
    return (
      <div className="output-display">
        <div className="output-header">
          <h2>Formatted Output</h2>
        </div>
        <div className="output-content empty">
          <p>Formatted notes will appear here</p>
        </div>
      </div>
    )
  }

  return (
    <div className="output-display">
      <div className="output-header">
        <h2>Formatted Output</h2>
        <div className="output-actions">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'preview' ? 'active' : ''}`}
              onClick={() => setViewMode('preview')}
            >
              Preview
            </button>
            <button
              className={`toggle-btn ${viewMode === 'raw' ? 'active' : ''}`}
              onClick={() => setViewMode('raw')}
            >
              Raw
            </button>
          </div>
          <button
            className="copy-btn"
            onClick={() => navigator.clipboard.writeText(content)}
          >
            Copy
          </button>
          <button
            className="export-btn"
            onClick={onExportWord}
          >
            Export .docx
          </button>
        </div>
      </div>
      {viewMode === 'preview' && (
        <p className="preview-disclaimer">This is a preview and may contain errors. Export for final formatting.</p>
      )}
      <div className={`output-content ${viewMode === 'preview' ? 'preview-mode' : ''}`}>
        {viewMode === 'preview' ? (
          <FormattedPreview content={content} takeawayBullet={takeawayBullet} discussionBullet={discussionBullet} />
        ) : (
          <pre>{content}</pre>
        )}
      </div>

      {/* Save to Project actions */}
      {currentProject && user && (
        <div className="save-to-project-bar">
          <button
            className={`save-project-btn ${savedNote ? 'saved' : ''}`}
            onClick={handleSaveNote}
            disabled={savingNote || savedNote}
          >
            {savedNote ? 'Note Saved' : savingNote ? 'Saving...' : 'Save Note'}
          </button>
          <button
            className={`master-append-btn ${appendedToMaster ? 'saved' : ''}`}
            onClick={handleShowMasterPicker}
            disabled={appendingToMaster || appendedToMaster || showMasterPicker}
          >
            {appendedToMaster ? 'Appended to Master' : appendingToMaster ? 'Appending...' : 'Append to Master Doc'}
          </button>
        </div>
      )}

      {/* Inline master doc picker */}
      {showMasterPicker && currentProject && user && (
        <div className="master-picker-inline">
          {loadingMasters ? (
            <div className="master-picker-loading">Loading master documents...</div>
          ) : (
            <>
              {masterDocs.length > 0 && !showCreateMaster && (
                <div className="master-picker-list">
                  {masterDocs.map((doc) => (
                    <button
                      key={doc.id}
                      className={`master-picker-item ${selectedMasterId === doc.id ? 'selected' : ''}`}
                      onClick={() => setSelectedMasterId(doc.id)}
                    >
                      <span className="master-picker-item-name">{doc.name}</span>
                      <span className="master-picker-item-count">{doc.appendCount || 0} notes</span>
                    </button>
                  ))}
                </div>
              )}

              {masterDocs.length === 0 && !showCreateMaster && (
                <div className="master-picker-empty">No master documents yet</div>
              )}

              {!showCreateMaster && masterDocs.length > 0 && (
                <div className="master-picker-actions">
                  <button
                    className="master-picker-create-btn"
                    onClick={() => setShowCreateMaster(true)}
                  >
                    + New Master Doc
                  </button>
                  <div className="master-picker-right-actions">
                    <button
                      className="master-picker-cancel"
                      onClick={() => { setShowMasterPicker(false); setSelectedMasterId(null) }}
                    >
                      Cancel
                    </button>
                    <button
                      className="master-picker-confirm"
                      onClick={handleAppendToMaster}
                      disabled={!selectedMasterId || appendingToMaster}
                    >
                      {appendingToMaster ? 'Appending...' : 'Append'}
                    </button>
                  </div>
                </div>
              )}

              {showCreateMaster && (
                <div className="master-picker-create-form">
                  <input
                    type="text"
                    className="master-picker-name-input"
                    placeholder="Master document name..."
                    value={newMasterName}
                    onChange={(e) => setNewMasterName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateFirstMaster()
                      if (e.key === 'Escape') {
                        if (masterDocs.length > 0) {
                          setShowCreateMaster(false)
                          setNewMasterName('')
                        } else {
                          setShowMasterPicker(false)
                          setShowCreateMaster(false)
                          setNewMasterName('')
                        }
                      }
                    }}
                  />
                  <div className="master-picker-actions">
                    <button
                      className="master-picker-cancel"
                      onClick={() => {
                        if (masterDocs.length > 0) {
                          setShowCreateMaster(false)
                          setNewMasterName('')
                        } else {
                          setShowMasterPicker(false)
                          setShowCreateMaster(false)
                          setNewMasterName('')
                        }
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="master-picker-confirm"
                      onClick={handleCreateFirstMaster}
                      disabled={!newMasterName.trim() || appendingToMaster}
                    >
                      {appendingToMaster ? 'Creating...' : 'Create & Add Note'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
