import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import './UserMenu.css'

function UserMenu() {
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

  if (loading) {
    return <div className="user-menu-loading">...</div>
  }

  if (!isAuthenticated) {
    return (
      <button
        className="sign-in-btn"
        onClick={handleSignIn}
        disabled={isSigningIn}
      >
        {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
      </button>
    )
  }

  return (
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
          />
        ) : (
          <div className="user-avatar-placeholder">
            {(user.displayName || user.email || 'U')[0].toUpperCase()}
          </div>
        )}
        <span className="user-name">{user.displayName || user.email}</span>
      </button>

      {isDropdownOpen && (
        <>
          <div
            className="user-menu-backdrop"
            onClick={() => setIsDropdownOpen(false)}
          />
          <div className="user-menu-dropdown">
            <div className="user-menu-header">
              <div className="user-email">{user.email}</div>
            </div>
            <button className="user-menu-item" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default UserMenu
