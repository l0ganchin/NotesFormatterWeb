// File storage service - handles file CRUD with Firebase Storage + Firestore metadata
import {
  db, storage,
  doc, collection, getDocs, getDoc, setDoc, deleteDoc, updateDoc,
  query, orderBy, serverTimestamp,
  ref, uploadBytes, deleteObject, getDownloadURL
} from './firebase'

// Upload a transcript file to Storage and create Firestore metadata
export async function uploadTranscript(projectId, file, metadata) {
  const transcriptsRef = collection(db, 'projects', projectId, 'transcripts')
  const newDocRef = doc(transcriptsRef)
  const transcriptId = newDocRef.id

  const storagePath = `projects/${projectId}/transcripts/${transcriptId}.docx`
  const storageRef = ref(storage, storagePath)

  // Upload file to Storage
  let fileBlob = file
  if (file instanceof File) {
    const arrayBuffer = await file.arrayBuffer()
    fileBlob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  }
  await uploadBytes(storageRef, fileBlob)

  // Create Firestore metadata
  await setDoc(newDocRef, {
    fileName: metadata.fileName || file.name || 'transcript.docx',
    respondentName: metadata.respondentName || '',
    respondentRole: metadata.respondentRole || '',
    respondentCompany: metadata.respondentCompany || '',
    uploadedBy: metadata.uploadedBy,
    uploadedByName: metadata.uploadedByName || '',
    createdAt: serverTimestamp(),
    storagePath,
    fileSizeBytes: fileBlob.size || 0
  })

  return transcriptId
}

// Upload a formatted note (.docx blob) to Storage and create Firestore metadata
export async function uploadFormattedNote(projectId, docxBlob, metadata) {
  const notesRef = collection(db, 'projects', projectId, 'formattedNotes')
  const newDocRef = doc(notesRef)
  const noteId = newDocRef.id

  const storagePath = `projects/${projectId}/formattedNotes/${noteId}.docx`
  const storageRef = ref(storage, storagePath)

  await uploadBytes(storageRef, docxBlob)

  await setDoc(newDocRef, {
    fileName: metadata.fileName || 'formatted_notes.docx',
    respondentName: metadata.respondentName || '',
    respondentRole: metadata.respondentRole || '',
    respondentCompany: metadata.respondentCompany || '',
    sourceTranscriptId: metadata.sourceTranscriptId || '',
    createdBy: metadata.createdBy,
    createdByName: metadata.createdByName || '',
    createdAt: serverTimestamp(),
    storagePath,
    fileSizeBytes: docxBlob.size || 0
  })

  return noteId
}

// Create a new master document
export async function createMasterDoc(projectId, name, initialDocxBlob, metadata) {
  const masterRef = collection(db, 'projects', projectId, 'masterDocs')
  const newDocRef = doc(masterRef)
  const masterDocId = newDocRef.id

  const storagePath = `projects/${projectId}/masterDocs/${masterDocId}.docx`
  const storageRef = ref(storage, storagePath)

  await uploadBytes(storageRef, initialDocxBlob)

  await setDoc(newDocRef, {
    name: name || 'Master Document',
    fileName: name.replace(/[/\\?%*:|"<>]/g, '_') + '.docx',
    createdBy: metadata.createdBy,
    createdByName: metadata.createdByName || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastAppendedBy: metadata.createdBy,
    appendCount: 1,
    storagePath,
    fileSizeBytes: initialDocxBlob.size || 0
  })

  return masterDocId
}

// Append a note to an existing master document
export async function appendToMasterDoc(projectId, masterDocId, noteDocxBlob, userId) {
  const masterDocRef = doc(db, 'projects', projectId, 'masterDocs', masterDocId)
  const masterSnap = await getDoc(masterDocRef)
  if (!masterSnap.exists()) throw new Error('Master document not found')

  const masterData = masterSnap.data()

  // Download existing master doc from Storage
  const existingRef = ref(storage, masterData.storagePath)
  const existingUrl = await getDownloadURL(existingRef)
  const existingBlob = await fetch(existingUrl).then(r => r.blob())
  const existingArrayBuffer = await existingBlob.arrayBuffer()
  const noteArrayBuffer = await noteDocxBlob.arrayBuffer()

  // Merge documents using docx-merger
  const DocxMerger = (await import('docx-merger')).default
  const merger = new DocxMerger({}, [existingArrayBuffer, noteArrayBuffer])
  const mergedBlob = await new Promise((resolve) => {
    merger.save('blob', (data) => resolve(data))
  })

  // Upload merged file back to Storage (overwrite)
  await uploadBytes(existingRef, mergedBlob)

  // Update Firestore metadata
  await updateDoc(masterDocRef, {
    updatedAt: serverTimestamp(),
    lastAppendedBy: userId,
    appendCount: (masterData.appendCount || 0) + 1,
    fileSizeBytes: mergedBlob.size || 0
  })

  return masterData.appendCount + 1
}

// Download a file from Storage as a Blob
export async function downloadFile(storagePath) {
  const fileRef = ref(storage, storagePath)
  const url = await getDownloadURL(fileRef)
  const response = await fetch(url)
  return await response.blob()
}

// Delete a file from Storage and its Firestore metadata
export async function deleteFile(projectId, subcollection, docId) {
  // Get metadata to find storage path
  const docRef = doc(db, 'projects', projectId, subcollection, docId)
  const snap = await getDoc(docRef)
  if (snap.exists()) {
    const data = snap.data()
    // Delete from Storage
    if (data.storagePath) {
      try {
        const fileRef = ref(storage, data.storagePath)
        await deleteObject(fileRef)
      } catch (err) {
        console.warn('Storage file not found, continuing with metadata deletion:', err)
      }
    }
  }
  // Delete Firestore metadata
  await deleteDoc(docRef)
}

// Get all files in a project subcollection
export async function getProjectFiles(projectId, subcollection) {
  const colRef = collection(db, 'projects', projectId, subcollection)
  const q = query(colRef, orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Rename a file (update Firestore metadata only, storage path unchanged)
export async function renameFile(projectId, subcollection, docId, newName) {
  const docRef = doc(db, 'projects', projectId, subcollection, docId)
  const updateData = { fileName: newName }
  if (subcollection === 'masterDocs') {
    updateData.name = newName.replace(/\.docx$/i, '')
  }
  await updateDoc(docRef, updateData)
}
