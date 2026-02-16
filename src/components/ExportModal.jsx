import { useState, useRef, useEffect } from 'react'
import { getProjectFiles, appendToMasterDoc, createMasterDoc } from '../services/fileStorage'
import { parseMarkdownToDocx, DEFAULT_CONFIG } from '../services/export'
import { Document, Packer } from 'docx'
import './ExportModal.css'

export default function ExportModal({
  isOpen,
  onClose,
  onExport,
  currentProject,
  user,
  respondentInfo = {},
  output,
  takeawayBullet,
  discussionBullet
}) {
  const [mode, setMode] = useState(null) // 'new', 'append', or 'master'
  const [existingFile, setExistingFile] = useState(null)
  const [isExporting, setIsExporting] = useState(false)
  const fileInputRef = useRef(null)

  // Master doc state
  const [masterDocs, setMasterDocs] = useState([])
  const [selectedMasterId, setSelectedMasterId] = useState(null)
  const [loadingMasters, setLoadingMasters] = useState(false)
  const [showNewMaster, setShowNewMaster] = useState(false)
  const [newMasterName, setNewMasterName] = useState('')
  const [appendStatus, setAppendStatus] = useState('')

  useEffect(() => {
    if (mode === 'master' && currentProject) {
      loadMasterDocs()
    }
  }, [mode, currentProject])

  if (!isOpen) return null

  const loadMasterDocs = async () => {
    setLoadingMasters(true)
    try {
      const docs = await getProjectFiles(currentProject.id, 'masterDocs')
      setMasterDocs(docs)
    } catch (err) {
      console.error('Failed to load master docs:', err)
    } finally {
      setLoadingMasters(false)
    }
  }

  const handleNewDocument = async () => {
    setMode('new')
  }

  const handleConfirmNew = async () => {
    setIsExporting(true)
    try {
      await onExport({ mode: 'new' })
      handleClose()
    } catch (err) {
      alert('Export failed: ' + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  const handleAppendClick = () => {
    setMode('append')
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      setExistingFile(file)
    }
  }

  const handleAppendExport = async () => {
    if (!existingFile) return
    setIsExporting(true)
    try {
      await onExport({ mode: 'append', existingFile })
      handleClose()
    } catch (err) {
      alert('Export failed: ' + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  const handleMasterClick = () => {
    setMode('master')
  }

  const buildNoteBlob = async () => {
    const config = {
      ...DEFAULT_CONFIG,
      takeaway_bullet: { ...DEFAULT_CONFIG.takeaway_bullet, bullet: takeawayBullet || '\u2022' },
      discussion_bullet: { ...DEFAULT_CONFIG.discussion_bullet, bullet: discussionBullet || '\u2022' },
      quant_bullet: { ...DEFAULT_CONFIG.quant_bullet, bullet: discussionBullet || '\u2022' },
    }
    const paragraphs = parseMarkdownToDocx(output, config, true)
    const doc = new Document({ sections: [{ children: paragraphs }] })
    return await Packer.toBlob(doc)
  }

  const handleAppendToMaster = async () => {
    if (!selectedMasterId || !user || !currentProject) return
    setIsExporting(true)
    setAppendStatus('Preparing note...')
    try {
      const noteBlob = await buildNoteBlob()
      setAppendStatus('Appending to master document...')
      const newCount = await appendToMasterDoc(currentProject.id, selectedMasterId, noteBlob, user.uid)
      setAppendStatus(`Appended successfully (${newCount} notes total)`)
      setTimeout(() => handleClose(), 1500)
    } catch (err) {
      console.error('Append to master failed:', err)
      alert('Failed to append to master document: ' + err.message)
      setAppendStatus('')
    } finally {
      setIsExporting(false)
    }
  }

  const handleCreateNewMaster = async () => {
    if (!newMasterName.trim() || !user || !currentProject) return
    setIsExporting(true)
    setAppendStatus('Creating master document...')
    try {
      const noteBlob = await buildNoteBlob()
      await createMasterDoc(currentProject.id, newMasterName.trim(), noteBlob, {
        createdBy: user.uid,
        createdByName: user.displayName || ''
      })
      setAppendStatus('Master document created with this note!')
      setShowNewMaster(false)
      setNewMasterName('')
      setTimeout(() => handleClose(), 1500)
    } catch (err) {
      console.error('Create master failed:', err)
      alert('Failed to create master document: ' + err.message)
      setAppendStatus('')
    } finally {
      setIsExporting(false)
    }
  }

  const handleClose = () => {
    setMode(null)
    setExistingFile(null)
    setSelectedMasterId(null)
    setShowNewMaster(false)
    setNewMasterName('')
    setAppendStatus('')
    onClose()
  }

  return (
    <div className="export-modal-overlay" onClick={handleClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="export-modal-header">
          <h3>Export to Word</h3>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>

        <div className="export-modal-content">
          {!mode && (
            <div className="export-options">
              <button
                className="export-option-btn"
                onClick={handleNewDocument}
                disabled={isExporting}
              >
                <span className="option-icon">+</span>
                <span className="option-text">
                  <strong>Create New Document</strong>
                  <small>Download as a new .docx file</small>
                </span>
              </button>

              <button
                className="export-option-btn"
                onClick={handleAppendClick}
                disabled={isExporting}
              >
                <span className="option-icon">{'\u2295'}</span>
                <span className="option-text">
                  <strong>Append to Existing</strong>
                  <small>Add to an existing .docx file</small>
                </span>
              </button>

              {currentProject && user && (
                <button
                  className="export-option-btn"
                  onClick={handleMasterClick}
                  disabled={isExporting}
                >
                  <span className="option-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
                    </svg>
                  </span>
                  <span className="option-text">
                    <strong>Append to Master Doc</strong>
                    <small>Add to a project master document</small>
                  </span>
                </button>
              )}
            </div>
          )}

          {mode === 'new' && (
            <div className="new-mode">
              <p>This will create a new .docx file with your formatted notes.</p>

              <div className="new-actions">
                <button
                  className="back-btn"
                  onClick={() => setMode(null)}
                >
                  Back
                </button>
                <button
                  className="export-btn"
                  onClick={handleConfirmNew}
                  disabled={isExporting}
                >
                  {isExporting ? 'Exporting...' : 'Export'}
                </button>
              </div>
            </div>
          )}

          {mode === 'append' && (
            <div className="append-mode">
              <p>Select the .docx file to append to:</p>

              <input
                type="file"
                ref={fileInputRef}
                accept=".docx"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              {!existingFile ? (
                <button
                  className="select-file-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose File
                </button>
              ) : (
                <div className="selected-file">
                  <span className="file-name">{existingFile.name}</span>
                  <button
                    className="change-file-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change
                  </button>
                </div>
              )}

              <div className="append-actions">
                <button
                  className="back-btn"
                  onClick={() => {
                    setMode(null)
                    setExistingFile(null)
                  }}
                >
                  Back
                </button>
                <button
                  className="append-export-btn"
                  onClick={handleAppendExport}
                  disabled={!existingFile || isExporting}
                >
                  {isExporting ? 'Exporting...' : 'Export'}
                </button>
              </div>
            </div>
          )}

          {mode === 'master' && (
            <div className="master-mode">
              <p>Select a master document to append to:</p>

              {loadingMasters ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#666', fontSize: '0.85rem' }}>Loading master documents...</div>
              ) : (
                <div className="master-doc-list">
                  {masterDocs.map((doc) => (
                    <button
                      key={doc.id}
                      className={`master-doc-item ${selectedMasterId === doc.id ? 'selected' : ''}`}
                      onClick={() => setSelectedMasterId(doc.id)}
                    >
                      <strong>{doc.name}</strong>
                      <small>{doc.appendCount || 0} notes appended</small>
                    </button>
                  ))}

                  {masterDocs.length === 0 && !showNewMaster && (
                    <div style={{ padding: '0.75rem', textAlign: 'center', color: '#666', fontSize: '0.8rem' }}>
                      No master documents yet
                    </div>
                  )}

                  {!showNewMaster && (
                    <button
                      className="new-master-btn"
                      onClick={() => setShowNewMaster(true)}
                    >
                      + Create New Master Document
                    </button>
                  )}

                  {showNewMaster && (
                    <div className="new-master-form">
                      <input
                        type="text"
                        placeholder="Master document name..."
                        value={newMasterName}
                        onChange={(e) => setNewMasterName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateNewMaster()
                          if (e.key === 'Escape') { setShowNewMaster(false); setNewMasterName('') }
                        }}
                      />
                      <div className="new-master-form-actions">
                        <button onClick={() => { setShowNewMaster(false); setNewMasterName('') }}>Cancel</button>
                        <button
                          className="create-master-btn"
                          onClick={handleCreateNewMaster}
                          disabled={isExporting || !newMasterName.trim()}
                        >
                          {isExporting ? 'Creating...' : 'Create & Add Note'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {appendStatus && (
                <div className="append-status">{appendStatus}</div>
              )}

              <div className="append-actions">
                <button
                  className="back-btn"
                  onClick={() => {
                    setMode(null)
                    setSelectedMasterId(null)
                    setShowNewMaster(false)
                    setAppendStatus('')
                  }}
                >
                  Back
                </button>
                <button
                  className="append-export-btn"
                  onClick={handleAppendToMaster}
                  disabled={!selectedMasterId || isExporting}
                >
                  {isExporting ? 'Appending...' : 'Append to Master'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
