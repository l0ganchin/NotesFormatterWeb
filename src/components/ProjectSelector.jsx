import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getPresets, savePreset, deletePreset } from '../services/firebase'
import './ProjectSelector.css'

function ProjectSelector({ isOpen, onClose, currentProject, onSelectProject, onOneOffMode }) {
  const { user, isAuthenticated } = useAuth()
  const [projects, setProjects] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && isAuthenticated && user) {
      loadProjects()
    }
  }, [isOpen, isAuthenticated, user])

  const loadProjects = async () => {
    if (!user) return
    setIsLoading(true)
    setError('')
    try {
      const userProjects = await getPresets(user.uid)
      setProjects(userProjects)
    } catch (err) {
      console.error('Failed to load projects:', err)
      setError('Failed to load projects')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setError('Please enter a project name')
      return
    }
    if (!user) return

    setIsSaving(true)
    setError('')

    try {
      const project = {
        id: newProjectName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
        name: newProjectName.trim(),
        takeawaysGuidance: '',
        quantCategories: [],
        createdAt: new Date().toISOString()
      }

      await savePreset(user.uid, project)
      await loadProjects()
      setShowNewProject(false)
      setNewProjectName('')
      onSelectProject(project)
      onClose()
    } catch (err) {
      console.error('Failed to create project:', err)
      setError('Failed to create project')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSelectProject = (project) => {
    onSelectProject(project)
    onClose()
  }

  const handleDeleteProject = async (projectId, e) => {
    e.stopPropagation()
    if (!user) return
    if (!confirm('Delete this project? This cannot be undone.')) return

    try {
      await deletePreset(user.uid, projectId)
      await loadProjects()
      if (currentProject?.id === projectId) {
        onOneOffMode()
      }
    } catch (err) {
      console.error('Failed to delete project:', err)
      setError('Failed to delete project')
    }
  }

  const handleOneOffMode = () => {
    onOneOffMode()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="project-selector-overlay" onClick={onClose}>
      <div className="project-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="project-selector-header">
          <h2>My Projects</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="project-selector-content">
          {/* One-off mode option */}
          <button
            className={`project-option one-off-option ${!currentProject ? 'active' : ''}`}
            onClick={handleOneOffMode}
          >
            <div className="project-option-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
              </svg>
            </div>
            <div className="project-option-text">
              <strong>One-off Mode</strong>
              <span>Quick formatting without a project</span>
            </div>
            {!currentProject && <span className="active-badge">Active</span>}
          </button>

          <div className="project-list-header">
            <span>Your Projects</span>
            <button
              className="new-project-btn"
              onClick={() => setShowNewProject(true)}
            >
              + New Project
            </button>
          </div>

          {/* New project form */}
          {showNewProject && (
            <div className="new-project-form">
              <input
                type="text"
                placeholder="Project name..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateProject()
                  if (e.key === 'Escape') {
                    setShowNewProject(false)
                    setNewProjectName('')
                  }
                }}
              />
              <div className="new-project-actions">
                <button
                  className="cancel-btn"
                  onClick={() => {
                    setShowNewProject(false)
                    setNewProjectName('')
                  }}
                >
                  Cancel
                </button>
                <button
                  className="create-btn"
                  onClick={handleCreateProject}
                  disabled={isSaving || !newProjectName.trim()}
                >
                  {isSaving ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          )}

          {/* Project list */}
          {isLoading ? (
            <div className="project-loading">Loading projects...</div>
          ) : projects.length > 0 ? (
            <div className="project-list">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`project-option ${currentProject?.id === project.id ? 'active' : ''}`}
                  onClick={() => handleSelectProject(project)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleSelectProject(project)
                    }
                  }}
                >
                  <div className="project-option-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
                    </svg>
                  </div>
                  <div className="project-option-text">
                    <strong>{project.name}</strong>
                    <span>
                      Created {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {currentProject?.id === project.id && (
                    <span className="active-badge">Active</span>
                  )}
                  <button
                    className="delete-project-btn"
                    onClick={(e) => handleDeleteProject(project.id, e)}
                    title="Delete project"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="project-empty">
              No projects yet. Create one to save your settings.
            </div>
          )}

          {error && <div className="project-error">{error}</div>}
        </div>
      </div>
    </div>
  )
}

export default ProjectSelector
