import { useAuth } from '../contexts/AuthContext'
import './ProjectStatusBar.css'

function ProjectStatusBar({
  currentProject,
  onOpenProjects
}) {
  const { isAuthenticated } = useAuth()

  // Always show the component, but with different content based on auth state
  if (!isAuthenticated) {
    return (
      <div className="project-status-bar not-authenticated">
        <div className="project-status-info" onClick={onOpenProjects}>
          <div className="project-status-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
            </svg>
          </div>
          <div className="project-status-text">
            <span className="project-status-name">Sign in to manage projects</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`project-status-bar ${currentProject ? 'has-project' : ''}`}>
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
    </div>
  )
}

export default ProjectStatusBar
