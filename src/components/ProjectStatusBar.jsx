import { useRef } from 'react'
import './ProjectStatusBar.css'

function ProjectStatusBar({
  currentProject,
  masterDocFile,
  onOpenProjects,
  onMasterDocChange,
  onClearMasterDoc,
  isAuthenticated
}) {
  const fileInputRef = useRef(null)

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      onMasterDocChange(file)
    }
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="project-status-bar">
      <div className="project-status-info" onClick={onOpenProjects}>
        <div className="project-status-icon">
          {currentProject ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
            </svg>
          )}
        </div>
        <div className="project-status-text">
          <span className="project-status-label">
            {currentProject ? 'Project' : 'Mode'}
          </span>
          <span className="project-status-name">
            {currentProject?.name || 'One-off'}
          </span>
        </div>
        <svg className="project-status-arrow" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </div>

      {currentProject && (
        <div className="master-doc-section">
          <input
            type="file"
            ref={fileInputRef}
            accept=".docx,.pdf"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {masterDocFile || currentProject.masterDocName ? (
            <div className="master-doc-status">
              <div className="master-doc-info">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                </svg>
                <span className="master-doc-name">
                  {masterDocFile?.name || currentProject.masterDocName}
                </span>
              </div>
              <button
                className="master-doc-change-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Change master document"
              >
                Change
              </button>
              <button
                className="master-doc-clear-btn"
                onClick={onClearMasterDoc}
                title="Remove master document"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              className="set-master-doc-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              Set Master Document
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default ProjectStatusBar
