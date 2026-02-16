import { useState, useEffect } from 'react'
import { addProjectMember, removeProjectMember, getProjectMembers } from '../services/projectSharing'
import './ProjectSharing.css'

function ProjectSharing({ isOpen, onClose, project }) {
  const [members, setMembers] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (isOpen && project) {
      loadMembers()
    }
  }, [isOpen, project])

  const loadMembers = async () => {
    if (!project) return
    setIsLoading(true)
    setError('')
    try {
      const result = await getProjectMembers(project.id)
      setMembers(result)
    } catch (err) {
      console.error('Failed to load members:', err)
      setError('Failed to load members')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddMember = async () => {
    if (!email.trim() || !project) return
    setIsAdding(true)
    setError('')
    setSuccess('')
    try {
      const member = await addProjectMember(project.id, email.trim())
      setSuccess(`Added ${member.displayName || member.email}`)
      setEmail('')
      await loadMembers()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveMember = async (uid) => {
    if (!project) return
    setError('')
    try {
      await removeProjectMember(project.id, uid)
      await loadMembers()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!isOpen) return null

  return (
    <div className="sharing-overlay" onClick={onClose}>
      <div className="sharing-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sharing-header">
          <h3>Share Project</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="sharing-content">
          <p className="sharing-project-name">{project?.name}</p>

          {/* Add member form */}
          <div className="sharing-add-form">
            <input
              type="email"
              placeholder="Enter email address..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddMember()
              }}
            />
            <button
              className="sharing-add-btn"
              onClick={handleAddMember}
              disabled={isAdding || !email.trim()}
            >
              {isAdding ? 'Adding...' : 'Add'}
            </button>
          </div>

          {error && <div className="sharing-error">{error}</div>}
          {success && <div className="sharing-success">{success}</div>}

          {/* Members list */}
          <div className="sharing-members-label">Members</div>
          {isLoading ? (
            <div className="sharing-loading">Loading members...</div>
          ) : (
            <div className="sharing-members-list">
              {members.map((member) => (
                <div key={member.uid} className="sharing-member-row">
                  <div className="sharing-member-info">
                    <span className="sharing-member-name">
                      {member.displayName || 'Unknown User'}
                      {member.isOwner && <span className="owner-badge">Owner</span>}
                    </span>
                    <span className="sharing-member-email">{member.email}</span>
                  </div>
                  {!member.isOwner && (
                    <button
                      className="sharing-remove-btn"
                      onClick={() => handleRemoveMember(member.uid)}
                      title="Remove member"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              {members.length === 0 && (
                <div className="sharing-empty">No members yet</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProjectSharing
