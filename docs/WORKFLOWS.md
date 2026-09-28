# User Workflows

## 1. Basic Formatting (One-Off Mode)

### Steps
1. User opens the app (no project selected)
2. User picks the call type pill (Management / Customer / Expert) — this sets the header's "Type of Call" and loads that type's default parameters
3. (Optional) User types a Project Name (used in the Word header) and sets the interview Date
4. (Optional) User enters respondent Name/Role/Company in the Call Info section, adds extra company attendees with "+ Attendee", and taps WG initials in WG Attendees
5. User pastes transcript into the "Transcript" FileInput (or uploads .docx/.txt); meeting notes optional
6. (Optional) User adjusts settings:
   - Custom Style Instructions (free text, 1000 char max; tone/emphasis only — cannot override output structure)
   - Key Takeaways topical guidance (PromptSettings)
   - Quantitative categories (QuantSettings)
   - Format & Style options (FormatStyleSettings)
7. User clicks "Format Notes"
8. App calls `formatNotes()` → Claude API streaming response
9. Output appears progressively in OutputDisplay (preview mode), with the running-header bar and Date/Attendees block rendered from the current inputs
10. When complete, user can:
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
2. ExportModal opens with two options
3. User clicks "Create New Document" → "Export"
4. `exportToWord()` called with `mode: 'new'`, the export config, and `noteMeta`
5. `parseMarkdownToDocx()` converts markdown to docx paragraphs and injects the Date/Attendees block after the title
6. `Document` (WG template styles + running header with logo + core title property) + `Packer.toBlob()` creates the Word file
7. `saveAs()` downloads under the document title: `Winterberry Group -- [Company] [Project] [Type] Call Notes -- DD Month YYYY.docx` (previewed in the modal as "Saves as: …")

### Append to Existing File
1. User clicks "Append to Existing" in ExportModal
2. User selects a .docx file from their computer
3. User clicks "Export"
4. `exportToWord()` called with `mode: 'append'`
5. Existing file read as ArrayBuffer
6. New content built normally (native Word list bullets, metadata block included)
7. `mergeDocxBlobs()` injects the content after one page break, remapping the note's list IDs so its bullets stay live; the existing document's styles/lists/header/ToC are untouched (the appended note's own running header is dropped — the target's header wins)
8. Downloads as `originalname_updated.docx`

---

## 3. Project Management

### Create a Project
1. User clicks "My Projects" in header
2. If not signed in, Microsoft sign-in popup appears
3. ProjectSelector modal opens
4. User clicks "+ New Project"
5. Enters project name, presses Enter or clicks Create
6. `createProject()` creates the Firestore document with user as owner + member, `projectName`, and the three default presets
7. Project is auto-selected as active

### Select a Project
1. User opens ProjectSelector
2. Clicks on a project from the list
3. The project's presets load (legacy flat-settings projects are migrated on the spot); the active pill's preset fills the form and `projectName` fills the Project Name field
4. Save Preset button appears next to the pills

### Work with Presets
1. User switches pills to load that call type's saved parameters
2. Any edits apply to the current note immediately; a dot on the pill marks unsaved changes
3. "Save" writes the active pill's parameters (+ Project Name) to Firestore
4. Switching pills or formatting never discards unsaved edits; selecting a different project or one-off mode does

### Save As (any signed-in user, one-off mode included)
1. User clicks "Save As…" next to the pills
2. Modal lists the user's projects plus "+ New project"; call-type pills pick the destination slot (defaults to the active pill)
3. Save into a **new project**: project is created with default presets plus the chosen slot, and the app switches into it on that pill — the form values don't change
4. Save into an **existing project**: that project's chosen preset slot is overwritten (a hint warns about this); the app stays where it is

### One-Off Mode
1. User clicks "One-off Mode" in ProjectSelector
2. `currentProject` set to null
3. Pills reset to the three default presets; no Save button
4. Settings are not saved to cloud

### Delete a Project
1. User clicks trash icon on a project in ProjectSelector
2. Confirmation dialog appears
3. `deleteProject()` removes Firestore document

---

## 4. Project Sharing

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

## 5. Authentication

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

## 6. Resizable Panels

### Horizontal Panel Resizer (Input/Output)
1. User drags the vertical bar between input and output panels
2. `handleMouseMove` calculates new width percentage (clamped 30-70%)
3. `leftPanelWidth` state updates in real-time
4. On mouse up, width is saved to localStorage key `notes-formatter-panel-width`
5. Restored on page load

---

## 7. Formatting Stop/Cancel

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
3. Clears per-note inputs (transcript, notes, respondent info, extra attendees); the date resets to today
4. Clears output and errors
5. Custom style instructions and project context revert to the active pill's saved preset values
6. Does NOT change the selected project, the active pill, or other preset parameters
