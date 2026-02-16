// Firebase configuration and services
import { initializeApp } from 'firebase/app'
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore'
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  getBlob
} from 'firebase/storage'

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBQBTywNsQ3thVBphlg8lo2F9QPBLieqF4",
  authDomain: "wg-note-formatter-vf.firebaseapp.com",
  projectId: "wg-note-formatter-vf",
  storageBucket: "wg-note-formatter-vf.firebasestorage.app",
  messagingSenderId: "145560525637",
  appId: "1:145560525637:web:91ddc458fbc00b1039fc2c"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)
const storage = getStorage(app)
const googleProvider = new GoogleAuthProvider()
const microsoftProvider = new OAuthProvider('microsoft.com')
microsoftProvider.setCustomParameters({ tenant: 'c29afe05-358b-4330-94ad-d661e8b87a48' })

// Auth functions
export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider)
}

export function signInWithMicrosoft() {
  return signInWithPopup(auth, microsoftProvider)
}

export function signOutUser() {
  return signOut(auth)
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback)
}

export function getCurrentUser() {
  return auth.currentUser
}

// Firestore functions for presets
export async function savePreset(userId, preset) {
  const presetRef = doc(db, 'users', userId, 'presets', preset.id)
  await setDoc(presetRef, {
    ...preset,
    updatedAt: serverTimestamp()
  })
  return preset
}

export async function getPresets(userId) {
  const presetsRef = collection(db, 'users', userId, 'presets')
  const q = query(presetsRef, orderBy('updatedAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export async function getPreset(userId, presetId) {
  const presetRef = doc(db, 'users', userId, 'presets', presetId)
  const snapshot = await getDoc(presetRef)
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() }
  }
  return null
}

export async function deletePreset(userId, presetId) {
  const presetRef = doc(db, 'users', userId, 'presets', presetId)
  await deleteDoc(presetRef)
}

// ---- Top-level Projects collection (supports sharing) ----

export async function createProject(userId, projectData) {
  const projectsRef = collection(db, 'projects')
  const newDocRef = doc(projectsRef)
  const project = {
    ...projectData,
    id: newDocRef.id,
    userId,
    ownerId: userId,
    members: [userId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }
  await setDoc(newDocRef, project)
  return { ...project, id: newDocRef.id }
}

export async function getUserProjects(userId) {
  const projectsRef = collection(db, 'projects')
  const q = query(projectsRef, where('members', 'array-contains', userId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function updateProject(projectId, data) {
  const projectRef = doc(db, 'projects', projectId)
  await updateDoc(projectRef, {
    ...data,
    updatedAt: serverTimestamp()
  })
}

export async function deleteProject(projectId) {
  const projectRef = doc(db, 'projects', projectId)
  await deleteDoc(projectRef)
}

export async function getProject(projectId) {
  const projectRef = doc(db, 'projects', projectId)
  const snapshot = await getDoc(projectRef)
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() }
  }
  return null
}

// Migrate legacy presets (users/{uid}/presets) to top-level projects collection
export async function migrateLegacyPresets(userId) {
  const legacyRef = collection(db, 'users', userId, 'presets')
  const snapshot = await getDocs(legacyRef)
  if (snapshot.empty) return []

  const migrated = []
  for (const presetDoc of snapshot.docs) {
    const data = presetDoc.data()
    // Check if already migrated (has a migratedToProjectId field)
    if (data.migratedToProjectId) continue

    // Create new project in top-level collection
    const projectsRef = collection(db, 'projects')
    const newDocRef = doc(projectsRef)
    const project = {
      ...data,
      id: newDocRef.id,
      userId,
      ownerId: userId,
      members: [userId],
      createdAt: data.createdAt ? data.createdAt : serverTimestamp(),
      updatedAt: serverTimestamp()
    }
    // Remove old 'id' field that was the preset slug
    delete project.migratedToProjectId
    await setDoc(newDocRef, project)

    // Mark legacy preset as migrated
    await updateDoc(doc(db, 'users', userId, 'presets', presetDoc.id), {
      migratedToProjectId: newDocRef.id
    })

    migrated.push({ ...project, id: newDocRef.id })
  }
  return migrated
}

// Upsert user profile to users/{uid} collection for sharing lookups
export async function upsertUserProfile(user) {
  if (!user) return
  const userRef = doc(db, 'users', user.uid)
  await setDoc(userRef, {
    email: user.email || '',
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    updatedAt: serverTimestamp()
  }, { merge: true })
}

// Look up user by email in users collection
export async function lookupUserByEmail(email) {
  const usersRef = collection(db, 'users')
  const q = query(usersRef, where('email', '==', email))
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  const userDoc = snapshot.docs[0]
  return { uid: userDoc.id, ...userDoc.data() }
}

export {
  auth, db, storage,
  doc, collection, getDocs, getDoc, setDoc, deleteDoc, updateDoc,
  query, orderBy, where, serverTimestamp, arrayUnion, arrayRemove,
  ref, uploadBytes, getDownloadURL, deleteObject, getBlob
}
