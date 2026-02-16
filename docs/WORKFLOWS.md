# User Workflows

## 1. Basic Formatting (One-Off Mode)

### Steps
1. User opens the app (no project selected)
2. (Optional) User enters respondent Name/Role/Company in RespondentInput
3. User pastes meeting notes into the "Meeting Notes" FileInput (or uploads .docx/.txt)
4. User pastes transcript into the "Transcript" FileInput (or uploads .docx/.txt)
5. (Optional) User adjusts settings:
   - Custom Style Instructions (free text, 500 char max)
   - Key Takeaways topical guidance (PromptSettings)
   - Quantitative categories (QuantSettings)
   - Format & Style options (FormatStyleSettings)
6. User clicks "Format Notes"
7. App calls `formatNotes()` → Claude API streaming response
8. Output appears progressively in OutputDisplay (preview mode)
9. When complete, user can:
   - Toggle Preview/Raw view
   - Copy to clipboard
   - Click "Export .docx" → ExportModal opens

### Auto-Detection After Formatting
- If respondent fields were empty, `parseRespondentInfo()` extracts name/role/company from the `### Title` line and auto-fills RespondentInput
- If quant categories were empty, `parseQuantCategories()` extracts detected categories and auto-fills QuantSettings
- These are available for subsequent formatting runs

---

## 2. Export to Word Document

### New Document
1. User clicks "Export .docx" in OutputDisplay header
2. ExportModal opens with three options
3. User clicks "Create New Document" → "Export"
4. `exportToWord()` called with `mode: 'new'`
5. `parseMarkdownToDocx()` converts markdown to docx paragraphs
6. `Document` + `Packer.toBlob()` creates Word file
7. `saveAs()` downloads as `Name_Role_Company_Notes_YYYY-MM-DD.docx`

### Append to Existing File
1. User clicks "Append to Existing" in ExportModal
2. User selects a .docx file from their computer
3. User clicks "Export"
4. `exportToWord()` called with `mode: 'append'`
5. Existing file read as ArrayBuffer
6. New content created with page break prefix
7. `DocxMerger` merges existing + new
8. Downloads as `originalname_updated.docx`

### Append to Master Document (Project Mode)
1. User clicks "Append to Master Doc" in ExportModal
2. Modal shows list of project's master docs
3. User selects one (or creates new)
4. `appendToMasterDoc()` or `createMasterDoc()` called
5. For append: existing master downloaded, merged with new note, re-uploaded
6. Success message shown, modal closes after 1.5s

---

## 3. Project Management

### Create a Project
1. User clicks "My Projects" in header
2. If not signed in, Microsoft sign-in popup appears
3. ProjectSelector modal opens
4. User clicks "+ New Project"
5. Enters project name, presses Enter or clicks Create
6. `createProject()` creates Firestore document with user as owner + member
7. Project is auto-selected as active

### Select a Project
1. User opens ProjectSelector
2. Clicks on a project from the list
3. Project settings are loaded into all state variables
4. ProjectFiles panel appears in the input panel
5. All subsequent setting changes auto-save to this project

### One-Off Mode
1. User clicks "One-off Mode" in ProjectSelector
2. `currentProject` set to null
3. ProjectFiles panel hidden
4. Settings are not saved to cloud

### Delete a Project
1. User clicks trash icon on a project in ProjectSelector
2. Confirmation dialog appears
3. `deleteProject()` removes Firestore document
4. Note: This does NOT cascade-delete subcollections or Storage files

---

## 4. Project Files

### Upload a Transcript File
1. User is in project mode, ProjectFiles open, Transcripts tab active
2. Clicks "Upload File"
3. Selects .docx/.txt/.doc file
4. `uploadTranscript()` uploads blob to Storage + creates Firestore metadata
5. File appears in the transcripts list

### Save Current Input as Transcript
1. User has text in the transcript or notes textarea
2. "Save Current Input" button appears in Transcripts tab
3. Clicking converts text to .docx (plain paragraphs, Calibri 11pt)
4. Uploads as `Name_Role_Company_Transcript.docx`
5. File appears in transcripts list
6. Button shows "Saved!" for 3 seconds

### Save Formatted Note to Project
1. After formatting, OutputDisplay shows "Save Note" button (project mode)
2. Clicking builds .docx from output, uploads via `uploadFormattedNote()`
3. Button changes to "Note Saved" (disabled)
4. File appears in Notes tab of ProjectFiles

### Append to Master Doc (Inline)
1. After formatting, OutputDisplay shows "Append to Master Doc" button
2. Clicking opens inline picker below the button
3. If master docs exist: list items to select, then click "Append"
4. If no master docs: name input + "Create & Add Note" button
5. On success, button changes to "Appended to Master" (disabled)

### Export All Files
1. User clicks "Export All" button in any ProjectFiles tab
2. Each file in the current tab is downloaded individually
3. 500ms delay between downloads to avoid browser blocking
4. Button shows "Exporting..." during the process

### Rename a File
1. User clicks pencil icon on any file row
2. Filename becomes an editable input
3. User types new name, presses Enter (or clicks away to confirm)
4. `renameFile()` updates Firestore metadata
5. Escape cancels the rename

### Delete a File
1. User clicks trash icon on a file row
2. Confirmation bar appears: "Delete [filename]?" with Cancel/Delete
3. `deleteFile()` removes both Storage blob and Firestore metadata
4. File disappears from list

### Download a File
1. User clicks download icon on a file row
2. `downloadFile()` gets download URL → fetches blob
3. `saveAs()` triggers browser download

---

## 5. Project Sharing

### Add a Member
1. Project owner opens ProjectSelector
2. Clicks share icon (people) on a project
3. ProjectSharing modal opens
4. Enters team member's email address
5. `addProjectMember()` looks up user by email, adds to `members[]`
6. Member now has full read/write access to project + all its files
7. Requirement: The member must have signed in at least once

### Remove a Member
1. In ProjectSharing modal, click X next to a member
2. `removeProjectMember()` removes UID from `members[]`
3. Member loses access immediately
4. Cannot remove the project owner

---

## 6. Authentication

### Sign In
1. User clicks "Sign in with Microsoft" button in header
2. Firebase Microsoft OAuth popup opens
3. User authenticates with their org's Azure AD
4. On success: `onAuthStateChanged` fires, `AuthProvider` sets user state
5. `upsertUserProfile()` creates/updates user document in Firestore
6. All authenticated features become available

### Sign Out
1. User clicks avatar → dropdown → "Sign out"
2. `signOutUser()` clears Firebase auth session
3. UI reverts to unauthenticated state

---

## 7. Resizable Panels

### Horizontal Panel Resizer (Input/Output)
1. User drags the vertical bar between input and output panels
2. `handleMouseMove` calculates new width percentage (clamped 30-70%)
3. `leftPanelWidth` state updates in real-time
4. On mouse up, width is saved to localStorage key `notes-formatter-panel-width`
5. Restored on page load

### Vertical File List Resizer (ProjectFiles)
1. User drags the horizontal bar at bottom of ProjectFiles file list
2. `handleResizeMouseMove` calculates new height (clamped 80-600px)
3. `fileListHeight` state updates in real-time
4. On mouse up, height saved to localStorage key `pf-file-list-height`
5. Restored on page load

---

## 8. Formatting Stop/Cancel

### Stop Button
1. During formatting, a "Stop" button appears next to "Formatting..."
2. Clicking calls `abortControllerRef.current.abort()`
3. The fetch request is cancelled
4. Partial output remains visible
5. Error is suppressed (AbortError check)
6. User can format again or work with partial output

### Header Reset
1. Clicking the logo + "Notes Formatter" header text triggers `handleReset()`
2. Stops any in-progress formatting
3. Clears all inputs (transcript, notes, respondent info)
4. Clears output and errors
5. Resets custom style instructions to default
6. Does NOT change the selected project or its settings
