import { useState, useEffect, useRef, useCallback } from 'react'
import { getProjectFiles, deleteFile, downloadFile, renameFile, createMasterDoc, uploadTranscript } from '../services/fileStorage'
import { saveAs } from 'file-saver'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import './ProjectFiles.css'

const FILE_LIST_HEIGHT_KEY = 'pf-file-list-height'

function ProjectFiles({ projectId, isOpen, onToggle, user, transcript, notes, respondentInfo }) {
  const [activeTab, setActiveTab] = useState('transcripts')
  const [files, setFiles] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [showNewMaster, setShowNewMaster] = useState(false)
  const [newMasterName, setNewMasterName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const fileInputRef = useRef(null)

  // Rename state
  const [renamingFile, setRenamingFile] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  // Export all state
  const [isExportingAll, setIsExportingAll] = useState(false)

  // Save current input state
  const [isSavingInput, setIsSavingInput] = useState(false)
  const [savedInput, setSavedInput] = useState(false)

  // Resizable panel state
  const [fileListHeight, setFileListHeight] = useState(() => {
    const saved = localStorage.getItem(FILE_LIST_HEIGHT_KEY)
    return saved ? parseInt(saved, 10) : 200
  })
  const [isResizingPanel, setIsResizingPanel] = useState(false)
  const resizeStartY = useRef(0)
  const resizeStartHeight = useRef(0)

  const subcollectionMap = {
    transcripts: 'transcripts',
    notes: 'formattedNotes',
    master: 'masterDocs'
  }

  useEffect(() => {
    if (isOpen && projectId) {
      loadFiles()
    }
  }, [isOpen, projectId, activeTab])

  const loadFiles = async () => {
    setIsLoading(true)
    setError('')
    try {
      const subcollection = subcollectionMap[activeTab]
      const result = await getProjectFiles(projectId, subcollection)
      setFiles(result)
    } catch (err) {
      console.error('Failed to load files:', err)
      setError('Failed to load files')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = async (file) => {
    try {
      const blob = await downloadFile(file.storagePath)
      saveAs(blob, file.fileName || file.name || 'download.docx')
    } catch (err) {
      console.error('Download failed:', err)
      alert('Download failed: ' + err.message)
    }
  }

  const handleDeleteClick = (file) => {
    setDeleteConfirm(file)
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return
    try {
      const subcollection = subcollectionMap[activeTab]
      await deleteFile(projectId, subcollection, deleteConfirm.id)
      setDeleteConfirm(null)
      await loadFiles()
    } catch (err) {
      console.error('Delete failed:', err)
      alert('Delete failed: ' + err.message)
    }
  }

  const handleUploadTranscript = async (e) => {
    const file = e.target.files[0]
    if (!file || !user) return

    try {
      setIsLoading(true)
      await uploadTranscript(projectId, file, {
        fileName: file.name,
        uploadedBy: user.uid,
        uploadedByName: user.displayName || ''
      })
      await loadFiles()
    } catch (err) {
      console.error('Upload failed:', err)
      alert('Upload failed: ' + err.message)
    } finally {
      setIsLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleCreateMasterDoc = async () => {
    if (!newMasterName.trim() || !user) return
    setIsCreating(true)
    try {
      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              children: [new TextRun({ text: newMasterName.trim(), bold: true, size: 28, font: 'Aptos' })]
            })
          ]
        }]
      })
      const blob = await Packer.toBlob(doc)

      await createMasterDoc(projectId, newMasterName.trim(), blob, {
        createdBy: user.uid,
        createdByName: user.displayName || ''
      })
      setShowNewMaster(false)
      setNewMasterName('')
      await loadFiles()
    } catch (err) {
      console.error('Failed to create master doc:', err)
      alert('Failed to create master document: ' + err.message)
    } finally {
      setIsCreating(false)
    }
  }

  // --- Rename handlers ---
  const handleRenameClick = (file) => {
    setRenamingFile(file.id)
    setRenameValue(file.fileName || file.name || '')
  }

  const handleRenameConfirm = async () => {
    if (!renamingFile || !renameValue.trim()) {
      setRenamingFile(null)
      setRenameValue('')
      return
    }
    try {
      const subcollection = subcollectionMap[activeTab]
      await renameFile(projectId, subcollection, renamingFile, renameValue.trim())
      setRenamingFile(null)
      setRenameValue('')
      await loadFiles()
    } catch (err) {
      console.error('Rename failed:', err)
      alert('Rename failed: ' + err.message)
    }
  }

  const handleRenameCancel = () => {
    setRenamingFile(null)
    setRenameValue('')
  }

  // --- Export All handler (individual file downloads) ---
  const handleExportAll = async () => {
    if (files.length === 0) return
    setIsExportingAll(true)
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const blob = await downloadFile(file.storagePath)
        const fileName = file.fileName || file.name || `file_${file.id}.docx`
        saveAs(blob, fileName)
        // Small delay between downloads so the browser doesn't block them
        if (i < files.length - 1) {
          await new Promise(r => setTimeout(r, 500))
        }
      }
    } catch (err) {
      console.error('Export all failed:', err)
      alert('Export all failed: ' + err.message)
    } finally {
      setIsExportingAll(false)
    }
  }

  // --- Save current input handler ---
  const sanitizeFilename = (str) => {
    if (!str || !str.trim()) return 'Unknown'
    return str.trim().replace(/[/\\?%*:|"<>]/g, '_')
  }

  const handleSaveCurrentInput = async () => {
    const textContent = transcript || notes
    if (!textContent || !user) return
    setIsSavingInput(true)
    try {
      const doc = new Document({
        sections: [{
          children: textContent.split('\n').map(line =>
            new Paragraph({ children: [new TextRun({ text: line, font: 'Calibri', size: 22 })] })
          )
        }]
      })
      const blob = await Packer.toBlob(doc)

      const name = sanitizeFilename(respondentInfo?.name)
      const role = sanitizeFilename(respondentInfo?.role)
      const company = sanitizeFilename(respondentInfo?.company)
      const fileName = `${name}_${role}_${company}_Transcript.docx`

      await uploadTranscript(projectId, blob, {
        fileName,
        respondentName: respondentInfo?.name || '',
        respondentRole: respondentInfo?.role || '',
        respondentCompany: respondentInfo?.company || '',
        uploadedBy: user.uid,
        uploadedByName: user.displayName || ''
      })
      setSavedInput(true)
      await loadFiles()
      setTimeout(() => setSavedInput(false), 3000)
    } catch (err) {
      console.error('Failed to save current input:', err)
      alert('Failed to save: ' + err.message)
    } finally {
      setIsSavingInput(false)
    }
  }

  // --- Resize handlers ---
  const handleResizeMouseDown = useCallback((e) => {
    e.preventDefault()
    setIsResizingPanel(true)
    resizeStartY.current = e.clientY
    resizeStartHeight.current = fileListHeight
  }, [fileListHeight])

  const handleResizeMouseMove = useCallback((e) => {
    if (!isResizingPanel) return
    const delta = e.clientY - resizeStartY.current
    const newHeight = Math.max(80, Math.min(600, resizeStartHeight.current + delta))
    setFileListHeight(newHeight)
  }, [isResizingPanel])

  const handleResizeMouseUp = useCallback(() => {
    if (isResizingPanel) {
      setIsResizingPanel(false)
      localStorage.setItem(FILE_LIST_HEIGHT_KEY, fileListHeight.toString())
    }
  }, [isResizingPanel, fileListHeight])

  useEffect(() => {
    if (isResizingPanel) {
      document.addEventListener('mousemove', handleResizeMouseMove)
      document.addEventListener('mouseup', handleResizeMouseUp)
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
    }
    return () => {
      document.removeEventListener('mousemove', handleResizeMouseMove)
      document.removeEventListener('mouseup', handleResizeMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingPanel, handleResizeMouseMove, handleResizeMouseUp])

  const formatDate = (timestamp) => {
    if (!timestamp) return ''
    if (timestamp.toDate) return timestamp.toDate().toLocaleDateString()
    if (typeof timestamp === 'string') return new Date(timestamp).toLocaleDateString()
    return ''
  }

  const formatSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="project-files">
      <button className="project-files-toggle" onClick={onToggle}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className={`toggle-chevron ${isOpen ? 'open' : ''}`}>
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
        </svg>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
        </svg>
        <span>Project Files</span>
      </button>

      {isOpen && (
        <div className="project-files-content">
          <div className="project-files-tabs">
            <button
              className={`pf-tab ${activeTab === 'transcripts' ? 'active' : ''}`}
              onClick={() => setActiveTab('transcripts')}
            >
              Transcripts
            </button>
            <button
              className={`pf-tab ${activeTab === 'notes' ? 'active' : ''}`}
              onClick={() => setActiveTab('notes')}
            >
              Notes
            </button>
            <button
              className={`pf-tab ${activeTab === 'master' ? 'active' : ''}`}
              onClick={() => setActiveTab('master')}
            >
              Master Docs
            </button>
          </div>

          {/* Tab actions */}
          <div className="pf-tab-actions">
            {activeTab === 'transcripts' && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".docx,.txt,.doc"
                  onChange={handleUploadTranscript}
                  style={{ display: 'none' }}
                />
                <button className="pf-action-btn" onClick={() => fileInputRef.current?.click()}>
                  Upload File
                </button>
                {(transcript || notes) && (
                  <button
                    className={`pf-action-btn pf-save-input-btn ${savedInput ? 'saved' : ''}`}
                    onClick={handleSaveCurrentInput}
                    disabled={isSavingInput || savedInput}
                  >
                    {savedInput ? 'Saved!' : isSavingInput ? 'Saving...' : 'Save Current Input'}
                  </button>
                )}
              </>
            )}
            {activeTab === 'master' && (
              <button className="pf-action-btn" onClick={() => setShowNewMaster(true)}>
                New Master Doc
              </button>
            )}
            {files.length > 0 && (
              <button
                className="pf-action-btn pf-export-all-btn"
                onClick={handleExportAll}
                disabled={isExportingAll}
              >
                {isExportingAll ? 'Exporting...' : 'Export All'}
              </button>
            )}
          </div>

          {/* New master doc form */}
          {showNewMaster && activeTab === 'master' && (
            <div className="pf-new-master-form">
              <input
                type="text"
                placeholder="Master document name..."
                value={newMasterName}
                onChange={(e) => setNewMasterName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateMasterDoc()
                  if (e.key === 'Escape') { setShowNewMaster(false); setNewMasterName('') }
                }}
              />
              <div className="pf-new-master-actions">
                <button onClick={() => { setShowNewMaster(false); setNewMasterName('') }}>Cancel</button>
                <button className="pf-create-btn" onClick={handleCreateMasterDoc} disabled={isCreating || !newMasterName.trim()}>
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          )}

          {error && <div className="pf-error">{error}</div>}

          {/* File list */}
          {isLoading ? (
            <div className="pf-loading">Loading...</div>
          ) : files.length > 0 ? (
            <div className="pf-file-list" style={{ maxHeight: `${fileListHeight}px` }}>
              {files.map((file) => (
                <div key={file.id} className="pf-file-row">
                  <div className="pf-file-info">
                    {renamingFile === file.id ? (
                      <input
                        className="pf-rename-input"
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameConfirm()
                          if (e.key === 'Escape') handleRenameCancel()
                        }}
                        onBlur={handleRenameConfirm}
                        autoFocus
                      />
                    ) : (
                      <span className="pf-file-name">{file.fileName || file.name}</span>
                    )}
                    <span className="pf-file-meta">
                      {activeTab === 'transcripts' && file.respondentName && `${file.respondentName} · `}
                      {activeTab === 'transcripts' && file.uploadedByName && `by ${file.uploadedByName} · `}
                      {activeTab === 'notes' && file.respondentName && `${file.respondentName} · `}
                      {activeTab === 'notes' && file.createdByName && `by ${file.createdByName} · `}
                      {activeTab === 'master' && file.appendCount != null && `${file.appendCount} notes · `}
                      {formatDate(file.createdAt || file.updatedAt)}
                      {file.fileSizeBytes ? ` · ${formatSize(file.fileSizeBytes)}` : ''}
                    </span>
                  </div>
                  <div className="pf-file-actions">
                    <button className="pf-rename-btn" onClick={() => handleRenameClick(file)} title="Rename">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                      </svg>
                    </button>
                    <button className="pf-download-btn" onClick={() => handleDownload(file)} title="Download">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                      </svg>
                    </button>
                    <button className="pf-delete-btn" onClick={() => handleDeleteClick(file)} title="Delete">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="pf-empty">
              {activeTab === 'transcripts' && 'No transcripts saved yet'}
              {activeTab === 'notes' && 'No formatted notes saved yet'}
              {activeTab === 'master' && 'No master documents yet'}
            </div>
          )}

          {/* Vertical resize handle */}
          <div className="pf-resize-handle" onMouseDown={handleResizeMouseDown}>
            <div className="pf-resize-grip" />
          </div>

          {/* Delete confirmation */}
          {deleteConfirm && (
            <div className="pf-delete-confirm">
              <p>Delete "{deleteConfirm.fileName || deleteConfirm.name}"?</p>
              <div className="pf-delete-actions">
                <button onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button className="pf-confirm-delete-btn" onClick={handleConfirmDelete}>Delete</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ProjectFiles
