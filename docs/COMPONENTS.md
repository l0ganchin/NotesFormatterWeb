# Components Documentation

## `src/App.jsx` - Root Component

### Responsibility
Main application shell. Manages all formatting-related state, layout (resizable two-panel), and orchestrates the formatting workflow.

### Structure
- `App` component wraps `AppContent` in `<AuthProvider>`
- `AppContent` contains all the logic

### Key State

**Per-note state** (never saved to a preset):
| State | Type | Default | Description |
|-------|------|---------|-------------|
| transcript | string | '' | Raw transcript text |
| notes | string | '' | Raw meeting notes text |
| respondentInfo | object | {name:'', role:'', company:''} | Respondent details |
| respondentManuallyEdited | boolean | false | Whether user manually edited respondent fields |
| interviewDate | string | today (local) | `YYYY-MM-DD` for the "Date:" line |
| extraAttendees | string[] | [] | Additional names for the "[Company] Attendees:" line |
| output | string | '' | Formatted output (markdown) |
| isLoading / error / warning | | | Formatting status |

**Preset-scoped state** (one `useState` each; saved per call type via Save Preset): `takeawaysGuidance`, `takeawayPreset`, `detailLevel`, `quantCategories`, `includeImportance`, `coverageLevel`, `takeawayBullet`, `discussionBullet`, `formality`, `discussionQuestionFormat`, `customStyleInstructions`, `projectContext`, `wgAttendees`.

**Preset navigation state**:
| State | Type | Description |
|-------|------|-------------|
| activeCallType | string | 'management' \| 'customer' \| 'expert' — the active pill, also the header's Type of Call (default 'customer') |
| presetDrafts | object | Per-pill snapshots of unsaved edits, stashed on pill switch so switching never loses work |
| savedPresets | object | Mirror of what Firestore last had (dirty checks compare against this) |
| projectName | string | Linked to the project's actual `name` — editing it + Save renames the project. Feeds the Word header and doc title |
| company | string | Project-level client company for the doc title (edited in Project Metadata, saved with Save) |
| currentProject | object/null | Currently selected project |
| leftPanelWidth | number | Left panel width as percentage |

### Key Behaviors
- **handleFormat()**: Validates inputs, creates AbortController, calls `formatNotes()` with streaming. On completion, auto-detects respondent info and quant categories from output.
- **handleStop()**: Aborts the in-flight request via AbortController.
- **handleReset()**: Clears per-note inputs, output, and errors; date resets to today; custom style/context revert to the active pill's saved values. Clicking the header logo triggers this.
- **handleCallTypeChange()**: Snapshots the current values into `presetDrafts[oldPill]`, then applies `presetDrafts[newPill] ?? savedPresets[newPill]` into the form.
- **handleSavePreset()**: Explicit save (replaces the old debounced auto-save). Writes `presets.{activeCallType}` (dot-path `updateDoc`) + `projectName` to Firestore, syncs `savedPresets`, flashes "Saved ✓".
- **Project load** (keyed on project id via a ref guard): reads `currentProject.presets`, or migrates legacy flat settings via `migrateProjectToPresets()` with a one-time write-back; resets drafts; applies the active pill's preset.
- **Dirty tracking**: `JSON.stringify` comparison of normalized presets (canonical key order via `normalizePreset`); dirty pills show a dot, and an edited `projectName` marks the active pill dirty.
- **noteMeta**: `{ projectName, callType, interviewDate, respondentName, companyLabel, extraAttendees, wgAttendees }` assembled per render, passed to OutputDisplay (preview) and `exportToWord`.
- **Resizable panels**: Mouse drag on `.panel-resizer` adjusts `leftPanelWidth`, persisted to localStorage.

### Layout
```
┌─── Header (logo + h1 | UserMenu) ───────────────────┐
├─── Input Panel (leftPanelWidth%) ─┬── Resizer ─┬── Output Panel ──┤
│  PresetPillNav (pills + Save/As)  │   8px bar   │  OutputDisplay   │
│  ProjectMetadata (collapsible)    │             │                  │
│  RespondentInput (Call Info)      │             │                  │
│  WGAttendeesPicker                │             │                  │
│  FileInput (Transcript)           │             │                  │
│  Custom Style Instructions        │             │                  │
│  Project Context                  │             │                  │
│  FileInput (Meeting Notes,        │             │                  │
│    collapsible)                   │             │                  │
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
- `collapsible` prop (used for the optional Meeting Notes): renders as a dropdown-style toggle, collapsed by default, with an "Added" badge when it holds text

---

## `src/components/RespondentInput.jsx`

### Responsibility
"Call Info" section: respondent Name/Role/Company fields (auto-fill or manual), interview date, and additional company attendees.

### Props
| Prop | Type | Description |
|------|------|-------------|
| value | object | {name, role, company} |
| onChange | function(object) | Callback with updated {name, role, company} |
| onClear | function | Resets to empty and clears manual edit flag |
| isManuallyEdited | boolean | Whether user has manually typed in fields |
| interviewDate | string | `YYYY-MM-DD` for the note's "Date:" line |
| onInterviewDateChange | function(string) | Updates the date |
| extraAttendees | string[] | Additional company attendee names |
| onExtraAttendeesChange | function(array) | Updates the extra attendees |

### Behavior
- Shows "Auto-filled" badge when populated by the system
- Shows "Manual" badge when user has typed
- "Clear" button resets all fields and clears the manual edit flag
- When the user types in any field, the parent sets `respondentManuallyEdited = true`
- When manually edited, the exact info is passed to Claude's prompt to override auto-detection
- **"+ Attendee"** adds an editable extra-name row (each with a × remove button); name + extras fill the "[Company] Attendees:" line in the export
- **Date input** (`<input type="date">`) defaults to today, resets to today on app reset

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

## `src/components/HowToGuide.jsx`

### Responsibility
"How to Use" guide modal, opened from the ⓘ button next to the header title.

### Props
| Prop | Type | Description |
|------|------|-------------|
| isOpen | boolean | Whether the modal is shown |
| onClose | function | Closes the modal |

### Behavior
- Animated overlay (fade) + panel (slide-up/scale), consistent with design tokens
- Closes on Escape, backdrop click, or the × button
- Content: quick start, inputs (incl. additive meeting-notes rule), settings panels, output, exporting (incl. ToC update tip), projects
- Pure static content — update it when workflows change

---

## `src/components/WhatsNew.jsx`

### Responsibility
One-time "What's New" release popup. Shows automatically once per browser per release version, then never again until the version is bumped.

### Props
| Prop | Type | Description |
|------|------|-------------|
| isOpen | boolean | Whether the popup is shown |
| onClose | function | Dismisses and marks the version as seen |
| onOpenGuide | function | Dismisses and opens the HowToGuide modal |

### Behavior
- Exports `WHATS_NEW_VERSION`; App.jsx compares it against localStorage key `notes-formatter-whats-new-seen` on load and shows the popup on mismatch
- Every dismissal path (Got it, backdrop, Escape) stamps the version so it never re-shows
- **To announce a future release**: update the bullet list content AND bump `WHATS_NEW_VERSION`
- Storage failures (private browsing) are tolerated — the popup may just show again next visit

---

## `src/components/QuantSettings.jsx`

### Responsibility
Collapsible section for configuring quantitative score categories.

### Props
| Prop | Type | Description |
|------|------|-------------|
| categories | array | [{name, scale}] array |
| onCategoriesChange | function(array) | Updates categories array |
| includeImportance | boolean | Whether Importance ratings are expected for every category |
| onIncludeImportanceChange | function(bool) | Updates the importance toggle |

### Behavior
- Collapsed by default
- **Auto-Detect mode** (empty array): Shows message that Claude will auto-detect
- **Manual mode** (categories present): Shows list with name input + scale stepper (1-100) + remove button
- "+ Add Category" button appends a new `{name: '', scale: 10}` entry
- "Clear All (Auto-Detect)" button empties the array
- **"Include Importance ratings" checkbox**: when on, every quant category gets an `Importance:` bullet before Score (N/A when not asked); when off, Importance appears only if detected in the interview. Saved with project settings
- After first formatting, `parseQuantCategories()` auto-populates categories from output, and the Importance checkbox auto-checks if `**Importance:**` bullets were detected

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
Displays formatted output with preview/raw toggle and streaming indicator.

### Props
| Prop | Type | Description |
|------|------|-------------|
| content | string | Formatted output markdown |
| isLoading | boolean | Whether formatting is in progress |
| onExportWord | function | Opens ExportModal |
| takeawayBullet | string | For preview rendering |
| discussionBullet | string | For preview rendering |
| noteMeta | object/null | Header + metadata values, passed through to FormattedPreview |

### Display States
One stable layout across all states (header with toggle/Copy/Export always rendered; buttons disabled when not applicable) so the chrome never jumps when streaming starts or ends:
1. **Loading, no content**: Shimmering skeleton lines + rotating status messages (crossfade); spinner + tabular-nums timer in the header
2. **Loading, with content (streaming)**: Preview with `isStreaming` (incomplete tail line held back, rendered dimmed with a blinking caret); animated shimmer bar under the header; auto-scroll follows the stream only while the user is pinned to the bottom
3. **Empty**: "Formatted notes will appear here"
4. **Content ready**: Preview/Raw toggle, Copy button (shows "Copied ✓" feedback), Export .docx button

Streaming UI updates are throttled to a 100ms cadence in App.jsx (`onChunk` buffers into a ref, flushed on a timer) so bursts of chunks render smoothly.

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
Renders Claude's markdown output as styled HTML for the preview mode in OutputDisplay, mirroring the WG .docx template (Open Sans 12pt, 1.16 line spacing, 8pt after each paragraph — see FormattedPreview.css header comment).

### Props
| Prop | Type | Description |
|------|------|-------------|
| content | string | Markdown text to render |
| takeawayBullet | string | Bullet character for takeaway items |
| discussionBullet | string | Bullet character for discussion items |
| isStreaming | boolean | Holds back the incomplete last line during streaming |
| noteMeta | object/null | Renders the running-header bar and Date/Attendees block |

### Behavior
Parses markdown line-by-line (mirrors the logic in `export.js`) and returns React elements:
- A `.preview-doc-header` bar at the top (Segoe UI header text + WG logo) rendered from `noteMeta` via the shared `buildHeaderText()`
- `### Title` → `<h3 className="preview-title">` (black, bold), followed by the Date / [Company] Attendees / WG Attendees lines from the shared `buildMetaRows()` (bold labels)
- `**Key Takeaways:**` → `<h4 className="preview-section-header">`
- `***Question***` → `<p className="preview-question">`
- `- Bullet` → `<p className="preview-bullet">` with appropriate bullet character
- `**Category**` in quant → `<p className="preview-quant-category">`
- Score/Reason labels → bold within bullet

---

## `src/components/ExportModal.jsx`

### Responsibility
Modal dialog for exporting formatted output to Word documents.

### Props
| Prop | Type | Description |
|------|------|-------------|
| isOpen | boolean | Whether modal is visible |
| onClose | function | Close handler |
| onExport | function({mode, existingFile}) | Export callback from App.jsx (which supplies config + noteMeta to `exportToWord`) |
| documentTitle | string | Computed document title, shown as "Saves as: ….docx" in new-document mode |

### Two Export Modes
1. **Create New Document**: Downloads fresh .docx file to browser (full WG template incl. running header), named by the document title
2. **Append to Existing**: User selects a .docx file from their computer; output is merged after existing content via `mergeDocxBlobs()`. A hint notes that the target document's header is the one that survives an append

---

## `src/components/PresetPillNav.jsx`

### Responsibility
Top-of-panel segmented pill navigator (compact, fit-content) for the three call-type presets + Save and Save As buttons.

### Props
| Prop | Type | Description |
|------|------|-------------|
| activeCallType | string | Active pill |
| onChange | function(key) | Pill switch (App stashes/loads drafts) |
| dirtyByType | object | Per-pill unsaved-changes flags (dot indicator); passed empty in one-off mode |
| isProjectMode | boolean | Shows the Save button only when a project is active |
| onSave / isSaving / justSaved | | Save button wiring ("Saved ✓" flash) |
| canSaveAs | boolean | Shows the "Save As…" button (any signed-in user, one-off mode included) |
| onSaveAs | function | Opens SavePresetAsModal |

---

## `src/components/SavePresetAsModal.jsx`

### Responsibility
"Save As" dialog: copies the current parameters into any call-type slot of a new or existing project.

### Props
| Prop | Type | Description |
|------|------|-------------|
| isOpen / onClose | | Modal wiring |
| onSave | async function({project, newProjectName, callType}) | App's `handleSaveAs` performs the writes; the modal surfaces errors |
| user | object | Signed-in user (project list fetch) |
| currentProjectId | string/null | Pre-selects the current project and tags it "current" |
| defaultCallType | string | Pre-selects the active pill's call type |

### Behavior
- On open: fetches the user's projects (`getUserProjects`, sorted by updatedAt desc), resets choices
- Destination: "+ New project" (with name input) or an existing project row
- Call-type pills choose which preset slot to write; a hint warns that saving overwrites an existing project's slot
- App's `handleSaveAs`: **new project** → `createProject` seeded with defaults + the chosen slot, then switches into it on that pill (form values unchanged); **existing project** → dot-path preset write (legacy flat-settings projects get fully migrated first so a partial presets map can't shadow their old settings); saving into the currently open project syncs `savedPresets` in place

---

## `src/components/ProjectMetadata.jsx`

### Responsibility
Collapsible section under the pills holding the project-level metadata shared by all three presets: **Project Name** (blue + bold — it's linked to the project's actual `name`; renaming it and hitting Save renames the project) and **Company**. Both feed the exported document title; Project Name also fills the Word running header. The collapsed toggle shows a "Company · Project" summary. Persisted by the Save button (and carried into new projects by Save As); in one-off mode the values are freeform.

---

## `src/components/WGAttendeesPicker.jsx`

### Responsibility
Chip multi-select of the WG team initials (roster in `services/presets.js` `WG_TEAM`) for the "WG Attendees:" line. Selection is stored in canonical roster order regardless of click order; Clear button empties it. Bound to the preset-scoped `wgAttendees` state.

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
- Action buttons: rename (pencil, inline input — Enter/blur confirms, Escape cancels; calls `onProjectRenamed` so App syncs the active project), share (people icon), delete (trash icon)
- "New Project" button shows inline creation form; new projects are seeded with `company: ''` and the three default presets (`buildAllDefaultPresets()`)
- Auto-migrates legacy presets on first load

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
- **Authenticated**: Shows a "Share" button when a project is active (opens ProjectSharing for it), "My Projects" button, user avatar with dropdown
- Dropdown: user name, email, sign out button

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

### `ProjectFiles.jsx` (deleted)
The project file browser (transcripts / formatted notes / master docs tabs) was removed along with the cloud master-doc feature and `services/fileStorage.js`. The retired Firestore subcollections are documented in DATA_MODEL.md.
