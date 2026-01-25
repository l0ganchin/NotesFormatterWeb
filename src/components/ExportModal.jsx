import { useState, useRef } from 'react'
import './ExportModal.css'

export default function ExportModal({ isOpen, onClose, onExport, exportType }) {
  const [mode, setMode] = useState(null) // 'new' or 'append'
  const [existingFile, setExistingFile] = useState(null)
  const [isExporting, setIsExporting] = useState(false)
  const fileInputRef = useRef(null)

  if (!isOpen) return null

  const handleNewDocument = async () => {
    setIsExporting(true)
    try {
      await onExport({ mode: 'new' })
      onClose()
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
      onClose()
    } catch (err) {
      alert('Export failed: ' + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  const handleClose = () => {
    setMode(null)
    setExistingFile(null)
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

          {mode === 'append' && (
            <div className="append-mode">
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
        </div>
      </div>
    </div>
  )
}
