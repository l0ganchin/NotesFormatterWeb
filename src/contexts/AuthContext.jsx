import { createContext, useContext, useState, useEffect } from 'react'
import { onAuthChange, signInWithGoogle, signInWithMicrosoft, signOutUser, upsertUserProfile } from '../services/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setUser(user)
      setLoading(false)
      // Upsert user profile for sharing lookups
      if (user) {
        upsertUserProfile(user).catch(err =>
          console.warn('Failed to upsert user profile:', err)
        )
      }
    })
    return unsubscribe
  }, [])

  const signInGoogle = async () => {
    try {
      await signInWithGoogle()
    } catch (error) {
      console.error('Google sign in error:', error)
      if (error.code === 'auth/account-exists-with-different-credential') {
        throw new Error('An account already exists with this email. Please sign in with Microsoft instead.')
      }
      throw error
    }
  }

  const signInMicrosoft = async () => {
    try {
      await signInWithMicrosoft()
    } catch (error) {
      console.error('Microsoft sign in error:', error)
      if (error.code === 'auth/account-exists-with-different-credential') {
        throw new Error('An account already exists with this email. Please sign in with Google instead.')
      }
      throw error
    }
  }

  const signOut = async () => {
    try {
      await signOutUser()
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    }
  }

  const value = {
    user,
    loading,
    signInGoogle,
    signInMicrosoft,
    signOut,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
