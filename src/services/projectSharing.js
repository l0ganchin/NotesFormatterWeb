// Project sharing service - manages project membership
import {
  db,
  doc, getDoc, updateDoc,
  arrayUnion, arrayRemove
} from './firebase'
import { lookupUserByEmail } from './firebase'

// Add a member to a project by email
export async function addProjectMember(projectId, email) {
  const user = await lookupUserByEmail(email)
  if (!user) {
    throw new Error('User not found. They need to sign in at least once before being added.')
  }

  const projectRef = doc(db, 'projects', projectId)
  const projectSnap = await getDoc(projectRef)
  if (!projectSnap.exists()) throw new Error('Project not found')

  const projectData = projectSnap.data()
  if (projectData.members && projectData.members.includes(user.uid)) {
    throw new Error('User is already a member of this project.')
  }

  await updateDoc(projectRef, {
    members: arrayUnion(user.uid)
  })

  return { uid: user.uid, email: user.email, displayName: user.displayName }
}

// Remove a member from a project
export async function removeProjectMember(projectId, uid) {
  const projectRef = doc(db, 'projects', projectId)
  const projectSnap = await getDoc(projectRef)
  if (!projectSnap.exists()) throw new Error('Project not found')

  const projectData = projectSnap.data()
  if (projectData.ownerId === uid) {
    throw new Error('Cannot remove the project owner.')
  }

  await updateDoc(projectRef, {
    members: arrayRemove(uid)
  })
}

// Get project members with their user info
export async function getProjectMembers(projectId) {
  const projectRef = doc(db, 'projects', projectId)
  const projectSnap = await getDoc(projectRef)
  if (!projectSnap.exists()) return []

  const projectData = projectSnap.data()
  const memberUids = projectData.members || []
  const ownerId = projectData.ownerId || projectData.userId

  const members = []
  for (const uid of memberUids) {
    const userRef = doc(db, 'users', uid)
    const userSnap = await getDoc(userRef)
    if (userSnap.exists()) {
      const userData = userSnap.data()
      members.push({
        uid,
        email: userData.email || '',
        displayName: userData.displayName || '',
        isOwner: uid === ownerId
      })
    } else {
      members.push({ uid, email: '', displayName: 'Unknown User', isOwner: uid === ownerId })
    }
  }

  // Sort so owner appears first
  members.sort((a, b) => (b.isOwner ? 1 : 0) - (a.isOwner ? 1 : 0))
  return members
}
