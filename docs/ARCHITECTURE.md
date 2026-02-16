# Notes Formatter Web - Architecture Overview

## Purpose of This Documentation
This folder provides a comprehensive reference for the entire application. It is designed so that an AI assistant (or any developer) can read these files and fully understand the program's intent, structure, data model, and component behavior — even without reading the source code directly.

**Update this documentation after every large batch of changes.**

---

## What This Application Does
Notes Formatter Web is an internal tool for a management consulting firm. It takes raw meeting notes and/or transcripts from client interviews, sends them to Claude (Anthropic's AI) for formatting, and produces polished, client-ready documentation in a standardized format. The output includes:
- A title line with respondent name, role, and company
- Key Takeaways (4-5 executive-level insights)
- Discussion section (comprehensive Q&A coverage)
- Quantitative Scores section (if applicable)

The formatted output can be exported as `.docx` Word documents, saved to cloud-based projects, and merged into master documents that aggregate multiple interviews.

---

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 (hooks, functional components) |
| Build | Vite 6 |
| AI | Claude API (claude-sonnet-4-20250514, streaming SSE) |
| Auth | Firebase Auth (Microsoft OAuth primary, Google OAuth secondary) |
| Database | Cloud Firestore |
| File Storage | Firebase Storage |
| Doc Generation | `docx` library (Word .docx creation) |
| Doc Merging | `docx-merger` (append documents) |
| File Reading | `mammoth` (extract text from .docx uploads) |
| File Download | `file-saver` (browser saveAs) |

---

## Documentation Index

| Document | Contents |
|----------|----------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | This file - overview, tech stack, file tree, data flow |
| [DATA_MODEL.md](DATA_MODEL.md) | Firestore collections, Storage paths, security rules |
| [SERVICES.md](SERVICES.md) | Service layer: firebase.js, claude.js, export.js, fileStorage.js, projectSharing.js |
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
      logo.png                   # Company logo displayed in header
    contexts/
      AuthContext.jsx             # Auth provider: user state, sign-in/out methods
    services/
      firebase.js                # Firebase init, auth helpers, Firestore CRUD for projects/presets
      claude.js                  # Claude API: prompt building, streaming SSE, response parsing
      export.js                  # Word doc generation: markdown-to-docx conversion, export/append
      fileStorage.js             # File CRUD: upload/download/delete with Storage + Firestore metadata
      projectSharing.js          # Project sharing: add/remove members by email
    components/
      FileInput.jsx/.css         # Text area with file upload (.docx/.txt) and drag-and-drop
      RespondentInput.jsx/.css   # Name/Role/Company fields with auto-fill detection
      PromptSettings.jsx/.css    # Key Takeaways topical guidance (auto-detect vs manual)
      QuantSettings.jsx/.css     # Quantitative score categories (auto-detect vs manual)
      FormatStyleSettings.jsx/.css # Coverage level, detail level, bullets, formality, question format
      OutputDisplay.jsx/.css     # Output panel: preview/raw toggle, save note, append to master
      FormattedPreview.jsx/.css  # Live preview renderer (markdown to styled HTML)
      ExportModal.jsx/.css       # Export dialog: new doc, append to file, append to master doc
      ProjectSelector.jsx/.css   # Project list modal: create, select, delete projects
      ProjectFiles.jsx/.css      # Project file browser: tabs, upload, download, rename, export all
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
Transcript    ──┘    (claude.js)       (claude-sonnet-4)      ──> setOutput()
                                                                    │
Settings:                                                           v
- Respondent Info                                           OutputDisplay
- Takeaways Guidance                                        (preview + raw)
- Quant Categories                                                  │
- Coverage/Detail/Formality                                         v
- Bullet Characters                                    ┌─── Export .docx (local)
- Discussion Format                                    ├─── Save Note (to project)
- Custom Instructions                                  └─── Append to Master Doc
```

---

## Key Architectural Patterns

### 1. State Lives in App.jsx
All formatting-related state (transcript, notes, respondentInfo, all settings) is managed in `App.jsx` and passed down as props. There is no external state management library.

### 2. Project Settings Auto-Save
When a project is active, settings changes are debounced (1 second) and auto-saved to Firestore via `updateProject()`. When a project is selected, its saved settings are loaded into state.

### 3. Two Modes: One-Off vs Project
- **One-off mode**: No project selected. User can format and export locally. No cloud storage.
- **Project mode**: A project is selected. Enables file browser, save-to-project, master doc management, and sharing.

### 4. Streaming Output
The Claude API call uses SSE (Server-Sent Events). The `formatNotes()` function reads the stream, accumulates text, and calls `onChunk()` to update the UI in real-time. Users see output appear progressively.

### 5. Auto-Detect vs Manual for Key Settings
Several settings support dual modes:
- **Key Takeaways**: Empty guidance = Claude auto-detects themes. User can provide topical bullet templates.
- **Quant Categories**: Empty = Claude auto-detects from transcript. User can specify exact categories + scales.
- **Respondent Info**: Empty = Claude extracts from notes/transcript. User can manually enter to override.

After formatting, the app parses Claude's output to auto-fill respondent info and quant categories for subsequent runs.

### 6. Firebase Storage + Firestore Metadata
Files (transcripts, notes, master docs) are stored as `.docx` blobs in Firebase Storage. Each file has a corresponding Firestore document with metadata (fileName, respondentName, storagePath, etc.). Downloads use `getDownloadURL()` + `fetch()` to retrieve files.

### 7. CORS Configuration
Firebase Storage requires CORS configuration for browser downloads. The `cors.json` file sets `"origin": ["*"]` since download URLs are already token-protected. This must be applied via `gsutil cors set cors.json gs://BUCKET_NAME`.
