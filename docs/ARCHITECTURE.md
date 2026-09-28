# Notes Formatter Web - Architecture Overview

## Purpose of This Documentation
This folder provides a comprehensive reference for the entire application. It is designed so that an AI assistant (or any developer) can read these files and fully understand the program's intent, structure, data model, and component behavior — even without reading the source code directly.

**Update this documentation after every large batch of changes.**

---

## What This Application Does
Notes Formatter Web is an internal tool for a management consulting firm (Winterberry Group). It takes raw meeting notes and/or transcripts from client interviews, sends them to Claude (Anthropic's AI) for formatting, and produces polished, client-ready documentation in the WG notes template. The output includes:
- A running header on every page: WG logo + "[Project name]: [Type of Call] Notes" (Management / Customer / Expert)
- A title line (Word Heading 1, black) with respondent name, role, and company
- A metadata block: Date, [Company] Attendees, WG Attendees
- Key Takeaways (4-5 executive-level insights)
- Discussion section (comprehensive Q&A coverage)
- Quantitative Scores section (if applicable)

The formatted output can be exported as a new `.docx` Word document or appended to an existing local `.docx`. Projects store one saved parameter preset per call type (Management / Customer / Expert), switched via pills at the top of the input panel.

---

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 (hooks, functional components) |
| Build | Vite 6 |
| AI | Claude API (claude-sonnet-4-6, streaming SSE) |
| Auth | Firebase Auth (Microsoft OAuth primary, Google OAuth secondary) |
| Database | Cloud Firestore |
| File Storage | Firebase Storage |
| Doc Generation | `docx` library (Word .docx creation) |
| Doc Merging | Custom JSZip merge with list-ID remapping (`mergeDocxBlobs` in docxMerge.js) |
| File Reading | `mammoth` (extract text from .docx uploads) |
| File Download | `file-saver` (browser saveAs) |

---

## Documentation Index

| Document | Contents |
|----------|----------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | This file - overview, tech stack, file tree, data flow |
| [DATA_MODEL.md](DATA_MODEL.md) | Firestore collections, Storage paths, security rules |
| [SERVICES.md](SERVICES.md) | Service layer: firebase.js, claude.js, export.js, presets.js, projectSharing.js |
| [COMPONENTS.md](COMPONENTS.md) | All React components: props, state, behavior, relationships |
| [WORKFLOWS.md](WORKFLOWS.md) | End-to-end user workflows: formatting, exporting, project management |

---

## File Tree
```
NotesFormatterWeb/
  docs/                          # This documentation folder
    ARCHITECTURE.md              # Overview and table of contents (this file)
    DATA_MODEL.md                # Firestore/Storage data model
    SERVICES.md                  # Service layer documentation
    COMPONENTS.md                # React component documentation
    WORKFLOWS.md                 # User workflow documentation
  src/
    main.jsx                     # Entry point: renders <App> in StrictMode
    App.jsx                      # Root component: layout, state, orchestration
    App.css                      # Global layout styles
    index.css                    # Base CSS reset/defaults
    assets/
      Logo.png                   # WG "wg" mark: app UI header (top left)
      logo-horizontal-winterberrygroup-red.png  # Full WG lockup (hi-res): embedded in the .docx running header + preview
    contexts/
      AuthContext.jsx             # Auth provider: user state, sign-in/out methods
    services/
      firebase.js                # Firebase init, auth helpers, Firestore CRUD for projects/presets
      claude.js                  # Claude API: prompt building, streaming SSE, response parsing
      export.js                  # Word doc generation: WG template styles, running header, metadata block, export/append
      presets.js                 # Call-type presets: defaults, WG team roster, migration, normalization
      projectSharing.js          # Project sharing: add/remove members by email
    components/
      PresetPillNav.jsx/.css     # Call-type pill navigator (Management/Customer/Expert) + Save Preset
      WGAttendeesPicker.jsx/.css # Chip multi-select of WG team initials
      FileInput.jsx/.css         # Text area with file upload (.docx/.txt) and drag-and-drop
      RespondentInput.jsx/.css   # Call info: Name/Role/Company, interview date, extra attendees
      PromptSettings.jsx/.css    # Key Takeaways topical guidance (auto-detect vs manual)
      QuantSettings.jsx/.css     # Quantitative score categories (auto-detect vs manual)
      FormatStyleSettings.jsx/.css # Coverage level, detail level, bullets, formality, question format
      OutputDisplay.jsx/.css     # Output panel: preview/raw toggle, copy, export
      FormattedPreview.jsx/.css  # Live preview renderer (markdown to styled HTML, WG template parity)
      ExportModal.jsx/.css       # Export dialog: new doc, append to local file
      ProjectSelector.jsx/.css   # Project list modal: create, select, delete projects
      ProjectSharing.jsx/.css    # Share project modal: add/remove members by email
      UserMenu.jsx/.css          # Header: sign-in button, user avatar, dropdown, project indicator
      PresetManager.jsx/.css     # Legacy preset management (mostly superseded by projects)
      ProjectStatusBar.jsx/.css  # Legacy status bar (not currently used)
      ApiKeyInput.jsx/.css       # Legacy API key input (API key now from env var)
  firestore.rules                # Firestore security rules
  storage.rules                  # Firebase Storage security rules
  cors.json                      # CORS config for Firebase Storage bucket
  vite.config.js                 # Vite configuration (React plugin)
  package.json                   # Dependencies and scripts
  .env                           # Environment variables (VITE_CLAUDE_API_KEY)
```

---

## High-Level Data Flow

```
User Input                    Claude API                    Output & Storage
-----------                   ----------                    ----------------
Meeting Notes  ──┐
                 ├──> buildPrompt() ──> POST /v1/messages ──> Streaming SSE
Transcript    ──┘    (claude.js)       (claude-sonnet-4-6)    ──> setOutput()
                                                                    │
Settings:                                                           v
- Call Type pill (preset)                                   OutputDisplay
- Respondent Info + Date + Attendees                        (preview + raw)
- Takeaways Guidance                                                │
- Quant Categories                                                  v
- Coverage/Detail/Formality                            ┌─── Export new .docx (local)
- Bullet Characters / Discussion Format                └─── Append to existing .docx (local)
- Custom Instructions
```

---

## Key Architectural Patterns

### 1. State Lives in App.jsx
All formatting-related state (transcript, notes, respondentInfo, all settings) is managed in `App.jsx` and passed down as props. There is no external state management library.

### 2. Call-Type Presets with Explicit Save
Each project stores three presets — Management, Customer, Expert — switched by the pill navigator at the top of the input panel. The active pill is also the "Type of Call" in the exported header. Any parameter can be overridden for the current note; changes persist only when the user hits **Save Preset** (dot-path `updateDoc` of `presets.{callType}`). Switching pills stashes unsaved edits in per-pill drafts so nothing is lost; dirty pills show a dot. Legacy flat-settings projects are migrated lazily (see DATA_MODEL.md).

### 3. Two Modes: One-Off vs Project
- **One-off mode**: No project selected. Pills still choose the call type (with defaults), a plain project-name field feeds the header, and export works locally. Nothing persists.
- **Project mode**: A project is selected. Presets load from Firestore, Save Preset persists them, and sharing is available.

### 4. Streaming Output
The Claude API call uses SSE (Server-Sent Events). The `formatNotes()` function reads the stream, accumulates text, and calls `onChunk()` to update the UI in real-time. Users see output appear progressively. The call runs at temperature 0.3 for run-to-run consistency, and binding style rules are restated after the transcript so long inputs don't wash out the settings.

### 4b. Bullet Glyphs Are a Render-Time Concern
The model always emits standard `- ` markdown bullets. The user-selected bullet characters (takeaway/discussion) are applied by FormattedPreview (on screen) and by the export layer (as native Word list bullets via `buildDocxBlob()`). Model output never contains custom glyphs, which keeps parsing deterministic.

### 5. Auto-Detect vs Manual for Key Settings
Several settings support dual modes:
- **Key Takeaways**: Empty guidance = Claude auto-detects themes. User can provide topical bullet templates.
- **Quant Categories**: Empty = Claude auto-detects from transcript. User can specify exact categories + scales.
- **Respondent Info**: Empty = Claude extracts from notes/transcript. User can manually enter to override.

After formatting, the app parses Claude's output to auto-fill respondent info and quant categories for subsequent runs.

### 6. Deterministic Metadata Injection
The Date / [Company] Attendees / WG Attendees block and the running header are never asked of the LLM. App.jsx assembles a `noteMeta` object from the inputs and the export layer (and FormattedPreview, via shared helpers `buildMetaRows`/`buildHeaderText`) injects them downstream of the model's markdown. This keeps the LLM contract unchanged and the metadata exact.

### 7. Firebase Storage (retired) & CORS
File storage (transcripts, formatted notes, cloud master docs) was removed along with the Project Files browser; Firestore now stores only project documents. The `cors.json` / `storage.rules` files remain from that era.
