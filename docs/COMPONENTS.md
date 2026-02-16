# Components Documentation

## `src/App.jsx` - Root Component

### Responsibility
Main application shell. Manages all formatting-related state, layout (resizable two-panel), and orchestrates the formatting workflow.

### Structure
- `App` component wraps `AppContent` in `<AuthProvider>`
- `AppContent` contains all the logic

### Key State
| State | Type | Default | Description |
|-------|------|---------|-------------|
| transcript | string | '' | Raw transcript text |
| notes | string | '' | Raw meeting notes text |
| respondentInfo | object | {name:'', role:'', company:''} | Respondent details |
| respondentManuallyEdited | boolean | false | Whether user manually edited respondent fields |
| takeawaysGuidance | string | DEFAULT_TAKEAWAYS_GUIDANCE | Topical guidance for key takeaways |
| takeawayPreset | string | 'customer' | Preset type: 'customer' or 'management' |
| detailLevel | string | 'balanced' | Detail per takeaway bullet |
| quantCategories | array | [] | Manual quant categories [{name, scale}] |
| coverageLevel | string | 'exhaustive' | Output exhaustiveness |
| takeawayBullet | string | U+2022 | Bullet character for takeaways |
| discussionBullet | string | U+2022 | Bullet character for discussion |
| formality | string | 'standard' | 'standard' (1st person) or 'formal' (3rd person) |
| discussionQuestionFormat | string | 'questions' | 'questions' or 'statements' |
| customStyleInstructions | string | 'Please be exhaustive...' | Free-text style instructions |
| output | string | '' | Formatted output (markdown) |
| isLoading | boolean | false | Whether formatting is in progress |
| error | string | '' | Error message |
| currentProject | object/null | null | Currently selected project |
| leftPanelWidth | number | 50 | Left panel width as percentage (persisted to localStorage) |

### Key Behaviors
- **handleFormat()**: Validates inputs, creates AbortController, calls `formatNotes()` with streaming. On completion, auto-detects respondent info and quant categories from output.
- **handleStop()**: Aborts the in-flight request via AbortController.
- **handleReset()**: Clears all inputs, output, and errors. Clicking the header logo triggers this.
- **handleExport()**: Opens ExportModal with custom bullet config.
- **Project settings auto-save**: When `currentProject` is set, a debounced (1s) `useEffect` saves all settings to Firestore.
- **Project settings load**: When `currentProject` changes, all settings are loaded from the project object.
- **Resizable panels**: Mouse drag on `.panel-resizer` adjusts `leftPanelWidth`, persisted to localStorage.

### Layout
```
┌─── Header (logo + h1 | UserMenu) ───────────────────┐
├─── Input Panel (leftPanelWidth%) ─┬── Resizer ─┬── Output Panel ──┤
│  ProjectFiles (if project active) │   8px bar   │  OutputDisplay   │
│  RespondentInput                  │             │                  │
│  FileInput (Meeting Notes)        │             │                  │
│  FileInput (Transcript)           │             │                  │
│  Custom Style Instructions        │             │                  │
│  PromptSettings                   │             │                  │
│  QuantSettings                    │             │                  │
│  FormatStyleSettings              │             │                  │
│  Format / Stop buttons            │             │                  │
└───────────────────────────────────┴─────────────┴──────────────────┘
  ExportModal (overlay)
  ProjectSelector (overlay)
  ProjectSharing (overlay)
```

---

## `src/components/FileInput.jsx`

### Responsibility
A text area with file upload and drag-and-drop support. Used twice in the input panel: once for "Meeting Notes" and once for "Transcript".

### Props
| Prop | Type | Description |
|------|------|-------------|
| label | string | Field label displayed above the textarea |
| value | string | Current text content |
| onChange | function(string) | Callback when text changes |
| placeholder | string | Textarea placeholder text |

### Behavior
- Textarea for direct text input
- "Upload File" button triggers hidden file input (.txt, .md, .docx)
- Drag-and-drop onto the text area
- `.docx` files are parsed to plain text using `mammoth.extractRawText()`
- `.doc` (old format) shows error: not supported
- "Clear" button appears when there's content

---

## `src/components/RespondentInput.jsx`

### Responsibility
Three input fields for respondent Name, Role, and Company. Supports auto-fill from Claude's output or manual entry.

### Props
| Prop | Type | Description |
|------|------|-------------|
| value | object | {name, role, company} |
| onChange | function(object) | Callback with updated {name, role, company} |
| onClear | function | Resets to empty and clears manual edit flag |
| isManuallyEdited | boolean | Whether user has manually typed in fields |

### Behavior
- Shows "Auto-filled" badge when populated by the system
- Shows "Manual" badge when user has typed
- "Clear" button resets all fields and clears the manual edit flag
- When the user types in any field, the parent sets `respondentManuallyEdited = true`
- When manually edited, the exact info is passed to Claude's prompt to override auto-detection

---

## `src/components/PromptSettings.jsx`

### Responsibility
Collapsible section for configuring Key Takeaways topical guidance.

### Props
| Prop | Type | Description |
|------|------|-------------|
| takeawaysGuidance | string | Current guidance text |
| onTakeawaysChange | function(string) | Updates guidance text |
| takeawayPreset | string | 'customer', 'management', or 'auto' |
| onPresetChange | function(string) | Updates preset |

### Behavior
- Collapsed by default; toggle shows/hides content
- **Auto-Detect mode** (guidance empty): Shows message that Claude will use best judgment + button to add guidance
- **Manual mode** (guidance non-empty): Shows editable textarea + "Clear (Auto-Detect)" button
- Info button opens a fixed-position dropdown with example templates for "Customer Calls" and "Management Calls"
- "Use this" button in dropdown populates the textarea with the template
- Mode badge in toggle header shows current mode

---

## `src/components/QuantSettings.jsx`

### Responsibility
Collapsible section for configuring quantitative score categories.

### Props
| Prop | Type | Description |
|------|------|-------------|
| categories | array | [{name, scale}] array |
| onCategoriesChange | function(array) | Updates categories array |

### Behavior
- Collapsed by default
- **Auto-Detect mode** (empty array): Shows message that Claude will auto-detect
- **Manual mode** (categories present): Shows list with name input + scale stepper (1-100) + remove button
- "+ Add Category" button appends a new `{name: '', scale: 10}` entry
- "Clear All (Auto-Detect)" button empties the array
- After first formatting, `parseQuantCategories()` auto-populates categories from output

---

## `src/components/FormatStyleSettings.jsx`

### Responsibility
Collapsible section with all format and style options.

### Props
| Prop | Type | Description |
|------|------|-------------|
| coverageLevel | string | 'focused', 'thorough', or 'exhaustive' |
| onCoverageLevelChange | function | |
| detailLevel | string | 'concise', 'balanced', or 'detailed' |
| onDetailLevelChange | function | |
| takeawayBullet | string | Bullet character |
| onTakeawayBulletChange | function | |
| discussionBullet | string | Bullet character |
| onDiscussionBulletChange | function | |
| discussionQuestionFormat | string | 'questions' or 'statements' |
| onDiscussionQuestionFormatChange | function | |
| formality | string | 'standard' or 'formal' |
| onFormalityChange | function | |

### Controls
1. **Coverage Level**: 3-button selector (focused/thorough/exhaustive) with description
2. **Key Takeaways Detail Level**: 3-button selector (concise/balanced/detailed) with description
3. **Key Takeaways Bullet**: Dropdown with 5 options (filled circle, empty circle, filled square, arrow, dash)
4. **Discussion Questions Format**: 2-button toggle (as questions / as statements)
5. **Discussion Bullet**: Same dropdown as above
6. **Formality**: 2-button toggle (standard=1st person / formal=3rd person)

---

## `src/components/OutputDisplay.jsx`

### Responsibility
Displays formatted output with preview/raw toggle, streaming indicator, and post-formatting actions (save note, append to master doc).

### Props
| Prop | Type | Description |
|------|------|-------------|
| content | string | Formatted output markdown |
| isLoading | boolean | Whether formatting is in progress |
| onExportWord | function | Opens ExportModal |
| takeawayBullet | string | For preview rendering |
| discussionBullet | string | For preview rendering |
| currentProject | object/null | Active project (enables save actions) |
| user | object/null | Authenticated user |
| respondentInfo | object | For generating filenames |
| transcript | string | (unused currently, passed for future use) |
| notes | string | (unused currently, passed for future use) |

### Display States
1. **Loading, no content**: Spinner + rotating status messages + elapsed timer
2. **Loading, with content (streaming)**: Shows preview + small spinner + timer, red bottom border
3. **Empty**: "Formatted notes will appear here"
4. **Content ready**: Preview/Raw toggle, Copy button, Export .docx button, save-to-project bar

### Post-Formatting Actions (project mode only)
1. **Save Note**: Converts output to .docx via `parseMarkdownToDocx()` + `Packer.toBlob()`, uploads via `uploadFormattedNote()`. Filename: `Name_Role_Company_Notes_YYYY-MM-DD.docx`
2. **Append to Master Doc**: Opens inline picker that:
   - Loads existing master docs from `getProjectFiles(projectId, 'masterDocs')`
   - If master docs exist: shows list to select + "Append" button + "+ New Master Doc" button
   - If no master docs: shows create form with name input + "Create & Add Note" button
   - Appending: builds note blob, calls `appendToMasterDoc()`
   - Creating: builds note blob, calls `createMasterDoc()`

### Loading Messages (rotate every 4 seconds)
1. "Reading through the transcript..."
2. "Identifying key themes and insights..."
3. "Synthesizing discussion points..."
4. "Crafting executive-level takeaways..."
5. "Formatting quantitative scores..."
6. "Polishing the final output..."
7. "Almost there..."

---

## `src/components/FormattedPreview.jsx`

### Responsibility
Renders Claude's markdown output as styled HTML for the preview mode in OutputDisplay.

### Props
| Prop | Type | Description |
|------|------|-------------|
| content | string | Markdown text to render |
| takeawayBullet | string | Bullet character for takeaway items |
| discussionBullet | string | Bullet character for discussion items |

### Behavior
Parses markdown line-by-line (mirrors the logic in `export.js`) and returns React elements:
- `### Title` → `<h3 className="preview-title">`
- `**Key Takeaways:**` → `<h4 className="preview-section-header">`
- `***Question***` → `<p className="preview-question">`
- `- Bullet` → `<p className="preview-bullet">` with appropriate bullet character
- `**Category**` in quant → `<p className="preview-quant-category">`
- Score/Reason labels → bold within bullet

---

## `src/components/ExportModal.jsx`

### Responsibility
Modal dialog for exporting formatted output to Word documents with three modes.

### Props
| Prop | Type | Description |
|------|------|-------------|
| isOpen | boolean | Whether modal is visible |
| onClose | function | Close handler |
| onExport | function({mode, existingFile}) | Export callback from App.jsx |
| currentProject | object/null | Active project (enables master doc mode) |
| user | object/null | Authenticated user |
| respondentInfo | object | For metadata |
| output | string | Formatted markdown |
| takeawayBullet | string | For docx generation |
| discussionBullet | string | For docx generation |

### Three Export Modes
1. **Create New Document**: Downloads fresh .docx file to browser
2. **Append to Existing**: User selects a .docx file from their computer; output is merged after existing content using `docx-merger`
3. **Append to Master Doc** (project mode only): Shows project's master doc list, select one to append to, or create a new master doc

---

## `src/components/ProjectSelector.jsx`

### Responsibility
Modal overlay for project management: list, create, select, delete projects.

### Props
| Prop | Type | Description |
|------|------|-------------|
| isOpen | boolean | Whether modal is visible |
| onClose | function | Close handler |
| currentProject | object/null | Currently active project |
| onSelectProject | function(project) | Called when user selects a project |
| onOneOffMode | function | Called when user selects one-off mode |
| onOpenSharing | function(project) | Opens sharing modal for a project |

### Behavior
- Opens with "My Projects" click or UserMenu
- Shows "One-off Mode" option at top (no project, quick formatting)
- Lists all projects where user is a member (sorted by updatedAt desc)
- Each project shows name, creation date, member count
- Action buttons: share (people icon), delete (trash icon)
- "New Project" button shows inline creation form
- Auto-migrates legacy presets on first load

---

## `src/components/ProjectFiles.jsx`

### Responsibility
Collapsible file browser panel shown in the input panel when a project is active. Three tabs for transcripts, notes, and master docs.

### Props
| Prop | Type | Description |
|------|------|-------------|
| projectId | string | Active project ID |
| isOpen | boolean | Whether panel is expanded |
| onToggle | function | Toggle expand/collapse |
| user | object | Authenticated user |
| transcript | string | Current transcript text (for "Save Current Input") |
| notes | string | Current notes text (for "Save Current Input") |
| respondentInfo | object | For generating filenames |

### Tabs
| Tab | Subcollection | Tab Actions |
|-----|--------------|-------------|
| Transcripts | `transcripts` | Upload File, Save Current Input (if text exists), Export All |
| Notes | `formattedNotes` | Export All |
| Master Docs | `masterDocs` | New Master Doc, Export All |

### Features
1. **Upload File** (transcripts tab): File picker for .docx/.txt/.doc, uploads via `uploadTranscript()`
2. **Save Current Input** (transcripts tab): Converts current transcript/notes text to .docx, uploads as transcript. Filename: `Name_Role_Company_Transcript.docx`
3. **Export All** (all tabs): Downloads all files in current tab individually with 500ms delays between downloads
4. **New Master Doc** (master tab): Inline form to create empty master document with title
5. **Rename** (all files): Pencil icon → inline input replaces filename → Enter to confirm, Escape to cancel
6. **Download** (all files): Downloads individual file via `downloadFile()` + `saveAs()`
7. **Delete** (all files): Confirmation prompt → deletes Storage file + Firestore metadata
8. **Resizable panel**: Drag handle at bottom adjusts file list height (80-600px), persisted to localStorage

### File Row Display
- Filename (or inline rename input)
- Metadata: respondent name, uploaded/created by, date, file size
- Action buttons: rename (pencil), download (arrow), delete (trash)

---

## `src/components/ProjectSharing.jsx`

### Responsibility
Modal for managing project membership (sharing).

### Props
| Prop | Type | Description |
|------|------|-------------|
| isOpen | boolean | Whether modal is visible |
| onClose | function | Close handler |
| project | object/null | Project to share |

### Behavior
- Email input to add new member
- `addProjectMember()` looks up user by email, adds to project
- Members list shows displayName, email, "Owner" badge for owner
- Non-owners have a remove button
- Requires the target user to have signed in at least once (so their profile exists in Firestore)

---

## `src/components/UserMenu.jsx`

### Responsibility
Header component showing sign-in button (when unauthenticated) or user avatar with dropdown (when authenticated).

### Props
| Prop | Type | Description |
|------|------|-------------|
| onOpenProjects | function | Opens ProjectSelector modal |
| currentProject | object/null | Currently active project |

### Behavior
- **Unauthenticated**: Shows "Sign in with Microsoft" button (primary auth method) + "My Projects" button (triggers sign-in first)
- **Authenticated**: Shows active project indicator (if any), "My Projects" button, user avatar with dropdown
- Dropdown: user name, email, sign out button
- Active project indicator: folder icon + project name, clickable to open ProjectSelector

---

## `src/contexts/AuthContext.jsx`

### Responsibility
React Context provider for authentication state.

### Provided Values
| Value | Type | Description |
|-------|------|-------------|
| user | object/null | Firebase auth user object |
| loading | boolean | Whether auth state is still being determined |
| signInGoogle | async function | Google sign-in with error handling |
| signInMicrosoft | async function | Microsoft sign-in with error handling |
| signOut | async function | Sign out |
| isAuthenticated | boolean | Whether user is signed in |

### Behavior
- Subscribes to `onAuthStateChanged` on mount
- Auto-upserts user profile to Firestore on sign-in
- Handles `auth/account-exists-with-different-credential` error gracefully
- `useAuth()` hook for consuming components

---

## Legacy/Unused Components

### `ApiKeyInput.jsx`
Originally used for entering the Claude API key in the UI. Now superseded by the `VITE_CLAUDE_API_KEY` environment variable. Not rendered in App.jsx.

### `PresetManager.jsx`
Legacy preset management component from before the projects system. Preset functionality is now handled by ProjectSelector and the projects Firestore collection.

### `ProjectStatusBar.jsx`
Legacy status bar component. Not currently rendered in the app.
