import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import './UserMenu.css'

// Google logo SVG component
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

// Folder icon for My Projects
function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
    </svg>
  )
}

function UserMenu({ onOpenProjects, currentProject }) {
  const { user, loading, signIn, signOut, isAuthenticated } = useAuth()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)

  const handleSignIn = async () => {
    setIsSigningIn(true)
    try {
      await signIn()
    } catch (error) {
      console.error('Failed to sign in:', error)
    } finally {
      setIsSigningIn(false)
    }
  }

  const handleSignOut = async () => {
    setIsDropdownOpen(false)
    try {
      await signOut()
    } catch (error) {
      console.error('Failed to sign out:', error)
    }
  }

  const handleMyProjectsClick = async () => {
    if (!isAuthenticated) {
      // If not signed in, trigger sign in first
      await handleSignIn()
      // After sign in, open projects (will be handled by the auth state change)
    } else {
      onOpenProjects?.()
    }
  }

  if (loading) {
    return <div className="user-menu-loading">...</div>
  }

  return (
    <div className="header-actions">
      {/* Active project indicator */}
      {currentProject && (
        <button
          className="active-project-btn"
          onClick={onOpenProjects}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
          </svg>
          <span>{currentProject.name}</span>
        </button>
      )}

      {/* My Projects button - always visible */}
      <button
        className="my-projects-btn"
        onClick={handleMyProjectsClick}
        disabled={isSigningIn}
      >
        <FolderIcon />
        <span>My Projects</span>
      </button>

      {/* Sign in or User menu */}
      {!isAuthenticated ? (
        <button
          className="google-sign-in-btn"
          onClick={handleSignIn}
          disabled={isSigningIn}
        >
          <GoogleLogo />
          <span>{isSigningIn ? 'Signing in...' : 'Sign in'}</span>
        </button>
      ) : (
        <div className="user-menu">
          <button
            className="user-menu-trigger"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="user-avatar"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="user-avatar-placeholder">
                {(user.displayName || user.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <svg className="dropdown-arrow" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </button>

          {isDropdownOpen && (
            <>
              <div
                className="user-menu-backdrop"
                onClick={() => setIsDropdownOpen(false)}
              />
              <div className="user-menu-dropdown">
                <div className="user-menu-header">
                  <span className="user-display-name">{user.displayName || 'User'}</span>
                  <span className="user-email">{user.email}</span>
                </div>
                <button className="user-menu-item sign-out" onClick={handleSignOut}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                  </svg>
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default UserMenu
