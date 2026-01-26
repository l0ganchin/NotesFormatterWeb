import { useState, useRef } from 'react'
import './ExportModal.css'

export default function ExportModal({
  isOpen,
  onClose,
  onExport,
  exportType,
  masterDocFile,
  currentProject
}) {
  const [mode, setMode] = useState(null) // 'new' or 'append'
  const [existingFile, setExistingFile] = useState(null)
  const [useMasterDoc, setUseMasterDoc] = useState(true)
  const [setAsMasterDoc, setSetAsMasterDoc] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const fileInputRef = useRef(null)

  // Check if master doc matches the export type
  const masterDocMatchesType = masterDocFile && (
    (exportType === 'word' && masterDocFile.name.endsWith('.docx')) ||
    (exportType === 'pdf' && masterDocFile.name.endsWith('.pdf'))
  )

  if (!isOpen) return null

  const handleNewDocument = async () => {
    setMode('new')
  }

  const handleConfirmNew = async () => {
    setIsExporting(true)
    try {
      await onExport({ mode: 'new', setAsMasterDoc: currentProject && setAsMasterDoc })
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
    const fileToUse = (useMasterDoc && masterDocMatchesType) ? masterDocFile : existingFile
    if (!fileToUse) return
    setIsExporting(true)
    try {
      await onExport({ mode: 'append', existingFile: fileToUse })
      handleClose()
    } catch (err) {
      alert('Export failed: ' + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  const handleClose = () => {
    setMode(null)
    setExistingFile(null)
    setSetAsMasterDoc(false)
    setUseMasterDoc(true)
    onClose()
  }

  const fileExtension = exportType === 'word' ? '.docx' : '.pdf'
  const fileAccept = exportType === 'word' ? '.docx' : '.pdf'

  return (
    <div className="export-modal-overlay" onClick={handleClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="export-modal-header">
          <h3>Export to {exportType === 'word' ? 'Word' : 'PDF'}</h3>
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
                  <small>Download as a new {fileExtension} file</small>
                </span>
              </button>

              <button
                className="export-option-btn"
                onClick={handleAppendClick}
                disabled={isExporting}
              >
                <span className="option-icon">⊕</span>
                <span className="option-text">
                  <strong>Append to Existing</strong>
                  <small>Add to an existing {fileExtension} file</small>
                </span>
              </button>
            </div>
          )}

          {mode === 'new' && (
            <div className="new-mode">
              <p>This will create a new {fileExtension} file with your formatted notes.</p>

              {currentProject && (
                <div className="master-doc-option">
                  <label className="master-doc-checkbox">
                    <input
                      type="checkbox"
                      checked={setAsMasterDoc}
                      onChange={(e) => setSetAsMasterDoc(e.target.checked)}
                    />
                    <span>Set as master document for <strong>{currentProject.name}</strong></span>
                  </label>
                  <small className="master-doc-hint">
                    Future notes in this project can be appended to this document
                  </small>
                </div>
              )}

              <div className="new-actions">
                <button
                  className="back-btn"
                  onClick={() => {
                    setMode(null)
                    setSetAsMasterDoc(false)
                  }}
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
              {masterDocMatchesType && (
                <div className="master-doc-option">
                  <label className="master-doc-checkbox">
                    <input
                      type="checkbox"
                      checked={useMasterDoc}
                      onChange={(e) => setUseMasterDoc(e.target.checked)}
                    />
                    <span>Use master document: <strong>{masterDocFile.name}</strong></span>
                  </label>
                </div>
              )}

              {(!masterDocMatchesType || !useMasterDoc) && (
                <>
                  <p>Select the {fileExtension} file to append to:</p>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept={fileAccept}
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
                </>
              )}

              <div className="append-actions">
                <button
                  className="back-btn"
                  onClick={() => {
                    setMode(null)
                    setExistingFile(null)
                    setUseMasterDoc(true)
                  }}
                >
                  Back
                </button>
                <button
                  className="append-export-btn"
                  onClick={handleAppendExport}
                  disabled={(!existingFile && !useMasterDoc) || (!masterDocMatchesType && !existingFile) || isExporting}
                >
                  {isExporting ? 'Exporting...' : 'Export'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
