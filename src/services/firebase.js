// Firebase configuration and services
import { initializeApp } from 'firebase/app'
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
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
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore'

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
const googleProvider = new GoogleAuthProvider()

// Auth functions
export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider)
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

export { auth, db }
