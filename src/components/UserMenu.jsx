import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import './UserMenu.css'

// Microsoft logo SVG component (four-color square)
function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  )
}

// Google logo SVG component
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
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

function UserMenu({ onOpenProjects, onOpenSharing, currentProject }) {
  const { user, loading, signInGoogle, signInMicrosoft, signOut, isAuthenticated } = useAuth()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [authError, setAuthError] = useState(null)

  const handleSignIn = async (provider) => {
    setIsSigningIn(true)
    setAuthError(null)
    try {
      if (provider === 'google') {
        await signInGoogle()
      } else {
        await signInMicrosoft()
      }
    } catch (error) {
      setAuthError(error.message)
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
      await handleSignIn()
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
          onClick={() => onOpenSharing?.(currentProject)}
          title="Share project"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
          </svg>
          <span>Share</span>
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
        <div className="sign-in-options">
          {authError && (
            <div className="auth-error">{authError}</div>
          )}
          <button
            className="google-sign-in-btn"
            onClick={() => handleSignIn('google')}
            disabled={isSigningIn}
          >
            <GoogleLogo />
            <span>{isSigningIn ? 'Signing in...' : 'Sign in with Google'}</span>
          </button>
          <button
            className="microsoft-sign-in-btn"
            onClick={() => handleSignIn('microsoft')}
            disabled={isSigningIn}
          >
            <MicrosoftLogo />
            <span>{isSigningIn ? 'Signing in...' : 'Sign in with Microsoft'}</span>
          </button>
        </div>
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
