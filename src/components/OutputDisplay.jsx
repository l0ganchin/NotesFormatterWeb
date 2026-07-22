import { useState, useEffect, useRef } from 'react'
import FormattedPreview from './FormattedPreview'
import { uploadFormattedNote, getProjectFiles, appendToMasterDoc, createMasterDoc } from '../services/fileStorage'
import { buildDocxBlob, DEFAULT_CONFIG } from '../services/export'
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
  const [copied, setCopied] = useState(false)

  // Auto-scroll: follow the stream only while the user is at (or near) the
  // bottom of the output; scrolling up to read releases the pin
  const contentRef = useRef(null)
  const pinnedToBottomRef = useRef(true)

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
    setCopied(false)
  }, [content])

  // Re-pin to bottom at the start of each new run
  useEffect(() => {
    if (isLoading && !content) {
      pinnedToBottomRef.current = true
    }
  }, [isLoading, content])

  // Follow the stream while pinned
  useEffect(() => {
    if (!isLoading) return
    const el = contentRef.current
    if (el && pinnedToBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [content, isLoading])

  const handleScroll = () => {
    const el = contentRef.current
    if (!el) return
    pinnedToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const handleCopy = () => {
    if (!content) return
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}m ${secs}s`
    }
    return `${secs}s`
  }

  const exportConfig = () => ({
    ...DEFAULT_CONFIG,
    takeaway_bullet: { ...DEFAULT_CONFIG.takeaway_bullet, bullet: takeawayBullet || '\u2022' },
    discussion_bullet: { ...DEFAULT_CONFIG.discussion_bullet, bullet: discussionBullet || '\u2022' },
    quant_bullet: { ...DEFAULT_CONFIG.quant_bullet, bullet: discussionBullet || '\u2022' },
  })

  const buildNoteBlob = async () => {
    return buildDocxBlob(content, exportConfig())
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
      const blob = await buildDocxBlob(content, exportConfig())

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

  const showEmpty = !isLoading && !content
  const showSkeleton = isLoading && !content

  // One stable layout across empty / waiting / streaming / done states, so
  // the chrome never jumps when streaming starts or finishes
  return (
    <div className="output-display">
      <div className="output-header">
        <h2>Formatted Output</h2>
        <div className="output-actions">
          {isLoading && (
            <div className="streaming-indicator">
              <div className="spinner-small"></div>
              <span className="streaming-timer">{formatTime(elapsedSeconds)}</span>
            </div>
          )}
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'preview' ? 'active' : ''}`}
              onClick={() => setViewMode('preview')}
              disabled={!content}
            >
              Preview
            </button>
            <button
              className={`toggle-btn ${viewMode === 'raw' ? 'active' : ''}`}
              onClick={() => setViewMode('raw')}
              disabled={!content}
            >
              Raw
            </button>
          </div>
          <button
            className={`copy-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            disabled={!content}
          >
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
          <button
            className="export-btn"
            onClick={onExportWord}
            disabled={!content || isLoading}
          >
            Export .docx
          </button>
        </div>
      </div>

      {isLoading && <div className="streaming-progress" />}

      {viewMode === 'preview' && content && (
        <p className="preview-disclaimer">This is a preview and may contain errors. Export for final formatting.</p>
      )}

      <div
        className={`output-content ${viewMode === 'preview' && content ? 'preview-mode' : ''} ${showEmpty ? 'empty' : ''}`}
        ref={contentRef}
        onScroll={handleScroll}
      >
        {showEmpty && <p>Formatted notes will appear here</p>}
        {showSkeleton && (
          <div className="output-skeleton">
            <div className="skeleton-line skeleton-title"></div>
            <div className="skeleton-line w-90"></div>
            <div className="skeleton-line w-75"></div>
            <div className="skeleton-line w-85"></div>
            <div className="skeleton-line w-60"></div>
            <p className="loading-status" key={messageIndex}>{LOADING_MESSAGES[messageIndex]}</p>
          </div>
        )}
        {content && (
          viewMode === 'preview' ? (
            <FormattedPreview
              content={content}
              takeawayBullet={takeawayBullet}
              discussionBullet={discussionBullet}
              isStreaming={isLoading}
            />
          ) : (
            <pre>{content}</pre>
          )
        )}
      </div>

      {/* Save to Project actions */}
      {content && !isLoading && currentProject && user && (
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
