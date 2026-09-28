import { useState } from 'react'
import './ProjectMetadata.css'

// Collapsible project-level metadata: Project Name and Company. Shared by all
// three call-type presets. Project Name is linked to the saved project itself —
// renaming it and hitting Save renames the project. Both feed the exported
// document title ("Winterberry Group -- [Company] [Project] [Type] Call Notes
// -- DD Month YYYY"); Project Name also fills the Word running header.
export default function ProjectMetadata({ projectName, onProjectNameChange, company, onCompanyChange }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const summary = [company, projectName].map((s) => (s || '').trim()).filter(Boolean).join(' · ')

  return (
    <div className="project-metadata">
      <button
        type="button"
        className="project-metadata-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        title="Company & project name — used in the Word header and document title"
      >
        <span className={`toggle-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
        <span className={`project-metadata-summary ${summary ? '' : 'empty'}`}>
          {summary || 'Set company & project name'}
        </span>
      </button>

      {isExpanded && (
        <div className="project-metadata-content">
          <div className="pm-field">
            <label htmlFor="pm-project-name">Project Name</label>
            <input
              id="pm-project-name"
              type="text"
              className="pm-input pm-project-name-input"
              value={projectName}
              onChange={(e) => onProjectNameChange(e.target.value)}
              placeholder="e.g. Impact of AI Study"
            />
            <p className="pm-hint">
              Linked to the saved project — rename here and hit Save to rename the project.
              Appears in the Word header and the document title.
            </p>
          </div>
          <div className="pm-field">
            <label htmlFor="pm-company">Company</label>
            <input
              id="pm-company"
              type="text"
              className="pm-input"
              value={company}
              onChange={(e) => onCompanyChange(e.target.value)}
              placeholder="e.g. Acme"
            />
            <p className="pm-hint">Appears in the exported document title.</p>
          </div>
        </div>
      )}
    </div>
  )
}
