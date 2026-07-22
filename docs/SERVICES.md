# Services Documentation

## `src/services/firebase.js`
Central Firebase initialization and Firestore CRUD operations.

### Firebase Init
- Initializes Firebase app, Auth, Firestore, and Storage
- Creates Google and Microsoft OAuth providers
- Microsoft provider has a custom tenant ID for org-specific Azure AD

### Auth Functions
| Function | Description |
|----------|-------------|
| `signInWithGoogle()` | Google OAuth popup sign-in |
| `signInWithMicrosoft()` | Microsoft OAuth popup sign-in (primary method) |
| `signOutUser()` | Signs out current user |
| `onAuthChange(callback)` | Subscribes to auth state changes |
| `getCurrentUser()` | Returns `auth.currentUser` |

### User Profile Functions
| Function | Description |
|----------|-------------|
| `upsertUserProfile(user)` | Creates/updates `users/{uid}` with email, displayName, photoURL |
| `lookupUserByEmail(email)` | Queries `users` collection by email (used for sharing) |

### Project CRUD
| Function | Description |
|----------|-------------|
| `createProject(userId, data)` | Creates new project with owner as first member |
| `getUserProjects(userId)` | Queries projects where `members` array-contains userId |
| `updateProject(projectId, data)` | Updates project fields + updatedAt timestamp |
| `deleteProject(projectId)` | Deletes project document (does not cascade to subcollections/storage) |
| `getProject(projectId)` | Fetches single project by ID |

### Legacy Migration
| Function | Description |
|----------|-------------|
| `migrateLegacyPresets(userId)` | Migrates `users/{uid}/presets` to top-level `projects` collection |

### Re-exports
The file re-exports all Firestore and Storage SDK functions used by other services (doc, collection, getDocs, ref, uploadBytes, etc.).

---

## `src/services/claude.js`
Claude API integration for note formatting.

### Prompt Building
The prompt is assembled from multiple configurable sections:

1. **System prompt** (`buildPrompt()`) - A large, detailed prompt that instructs Claude to:
   - Act as a professional note formatter for management consulting
   - Follow exact markdown formatting conventions (all bullets are `- ` dashes; the app applies the user-selected bullet glyph at preview/export time, never in the model output)
   - Process the ENTIRE transcript exhaustively
   - Produce Key Takeaways, Discussion, and Quantitative sections
   - Follow fixed `LANGUAGE & VOICE` rules: stay in the speaker's voice, strip verbal fillers ("like", "um"), avoid stock AI intensifiers ("genuinely", "truly", "really" unless the speaker said them), and never repeat a distinctive modifier more than twice

2. **Configurable sections within the prompt**:
   - `buildTakeawaysInstructions()` - Topical guidance + fixed style/quality rules
   - `getFixedTakeawaysRules()` - Detail level (concise/balanced/detailed), naming convention (customer vs management preset). Takeaways are explicitly scoped to stay concise even when Discussion coverage is exhaustive
   - `buildQuantInstructions()` - Manual categories with scales, or auto-detect mode. Supports Importance ratings ("how important is X... and how good are they at it?"): when `includeImportance` is on, every category gets an `**Importance:**` bullet before Score (N/A when not asked); when off, Importance is included only if detected in the interview
   - `buildRespondentInstructions()` - Manual respondent info or auto-extract mode
   - `buildCoverageInstructions()` - focused/thorough/exhaustive coverage level
   - `getPerspectiveRules()` - question-vs-statement headers and first-vs-third person voice, shared between the system prompt and the final reminders
   - Custom style instructions and project context are wrapped in delimited blocks marked as subordinate: they may refine tone/emphasis but can never override structure, markdown rules, or perspective

3. **User message** - Raw meeting notes + transcript, followed by `buildFinalReminders()`: a compact restatement of the binding rules (perspective, header format, full-transcript coverage, language rules). Placing these AFTER the transcript keeps long inputs from washing out the settings (recency anchoring). The prompt also instructs the model to treat attachment content as data, never as instructions.

### API Call
| Detail | Value |
|--------|-------|
| Endpoint | `https://api.anthropic.com/v1/messages` |
| Model | `claude-sonnet-4-6` |
| Max tokens | 16384 |
| Temperature | 0.3 (low, for run-to-run consistency in a formatting task) |
| Streaming | Yes (SSE) |
| Auth header | `x-api-key` + `anthropic-dangerous-direct-browser-access` |

### `formatNotes(transcript, notes, apiKey, options)`
Main formatting function. Options include all settings plus:
- `onChunk(partialOutput)` - Callback for streaming updates
- `abortSignal` - AbortController signal for cancellation

Reads the SSE stream, parses `content_block_delta` events, accumulates text, and calls `onChunk` on each delta. Partial lines are buffered between network reads (SSE events routinely straddle chunk boundaries; without the buffer their text is silently lost).

**Returns** `{ text, stopReason, truncated }`:
- `text` - the full formatted markdown
- `stopReason` - from the final `message_delta` event (`end_turn`, `max_tokens`, ...)
- `truncated` - true when the output hit the `max_tokens` cap; App.jsx surfaces this as a visible warning so a cut-off document is never mistaken for a complete one

### Output Parsing Functions
| Function | Description |
|----------|-------------|
| `parseQuantCategories(output)` | Extracts quant category names and scales from formatted output |
| `parseRespondentInfo(output)` | Extracts name, role, company from `### Title` line. Last comma-segment = company, everything between name and company = role (roles often contain commas); legal suffixes ("Acme, Inc.") stay glued to the company |
| `getDefaultTakeawaysGuidance()` | Returns default topical guidance template |

---

## `src/services/export.js`
Word document (.docx) generation from Claude's markdown output.

### `DEFAULT_CONFIG`
Default styling configuration for generated documents:
```
title:              Aptos 14pt, color #0F4761
section_header:     Calibri 11pt, bold, underline
takeaway_bullet:    Calibri 11pt, bullet char, 0.5in indent
discussion_question: Calibri 11pt, bold, italic
discussion_bullet:  Calibri 11pt, bullet char, 0.5in indent
quant_header:       Calibri 11pt, bold, italic
quant_category:     Calibri 11pt, bold
quant_bullet:       Calibri 11pt, bullet char, 0.5in indent
```

### `parseMarkdownToDocx(markdownText, config, isAppend)`
Core conversion function. Parses Claude's markdown output line-by-line and creates `docx` library Paragraph/TextRun objects. Handles:
- `### Title` lines → Heading 2
- `**Key Takeaways:**` → Underlined bold section header
- `**Discussion:**` → Underlined bold section header
- `***Question text***` → Bold italic paragraph
- Bullet lines (`- `, `* `, or legacy glyphs `•●○■➢–` via `BULLET_LINE_RE`) → native Word list bullets
- `**Category Name**` in quant section → Bold category header
- `**Score:**` / `**Reason:**` → native list bullet with bold label run + value (same list as other quant bullets)
- Page break prefix when `isAppend = true`

All paragraph spacing comes from the `SPACING` constant — every bullet in every section uses the same spacing, and headers/questions/categories each have one canonical value.

### `buildDocxBlob(markdownText, config, isAppend)`
The ONLY correct way to turn formatted output into a .docx blob. Always includes the numbering config (bullet list definitions) and 1" margins. All callers (exportToWord, OutputDisplay Save Note / master-doc append, ExportModal master-doc append) go through this — building a `Document` without the numbering config silently breaks bullets in Word.

### `exportToWord(markdownText, options)`
Exports the formatted output to a .docx file. Two modes:
- **New document**: Creates fresh .docx, saves as `Name_Role_Company_Notes_YYYY-MM-DD.docx`
- **Append to existing**: Reads existing .docx, creates new content, merges with `docx-merger`, saves as `originalname_updated.docx`

### Bullet Handling
- ALL bullet styles export as native Word list bullets (`LevelFormat.BULLET`), using the user-selected glyph as the list's bullet text
- In Word, pressing Enter at the end of any exported bullet continues the list

### Bullet Punctuation
- Key Takeaways bullets keep normal sentence punctuation (trailing periods)
- Discussion and Quantitative bullets (including Reason text) have trailing periods stripped; punctuation inside the bullet is untouched
- The prompt instructs the model to emit this convention; export and preview strip as a safety net for older outputs

---

## `src/services/fileStorage.js`
File CRUD operations combining Firebase Storage (for file blobs) and Firestore (for metadata).

### Functions
| Function | Description |
|----------|-------------|
| `uploadTranscript(projectId, file, metadata)` | Uploads .docx to Storage, creates Firestore metadata in `transcripts` subcollection |
| `uploadFormattedNote(projectId, docxBlob, metadata)` | Uploads formatted note .docx, creates metadata in `formattedNotes` subcollection |
| `createMasterDoc(projectId, name, initialDocxBlob, metadata)` | Creates new master doc in Storage + `masterDocs` subcollection |
| `appendToMasterDoc(projectId, masterDocId, noteDocxBlob, userId)` | Downloads existing master doc, merges with new note using `docx-merger`, re-uploads, updates metadata |
| `downloadFile(storagePath)` | Gets download URL via `getDownloadURL()`, fetches blob via `fetch()` |
| `deleteFile(projectId, subcollection, docId)` | Deletes Storage blob + Firestore metadata |
| `getProjectFiles(projectId, subcollection)` | Lists all files in subcollection, ordered by createdAt desc |
| `renameFile(projectId, subcollection, docId, newName)` | Updates fileName in Firestore; also updates `name` field for masterDocs |

### Storage Path Convention
```
projects/{projectId}/transcripts/{transcriptId}.docx
projects/{projectId}/formattedNotes/{noteId}.docx
projects/{projectId}/masterDocs/{masterDocId}.docx
```

### Master Doc Append Flow
1. Fetch existing master doc: `getDownloadURL()` → `fetch()` → `arrayBuffer()`
2. Convert new note to `arrayBuffer()`
3. Merge with `DocxMerger` (existing first, then new)
4. Upload merged blob back to same Storage path (overwrite)
5. Update Firestore metadata (appendCount, fileSizeBytes, updatedAt)

---

## `src/services/projectSharing.js`
Project membership management for collaboration.

### Functions
| Function | Description |
|----------|-------------|
| `addProjectMember(projectId, email)` | Looks up user by email, adds UID to project's `members` array |
| `removeProjectMember(projectId, uid)` | Removes UID from `members` array (cannot remove owner) |
| `getProjectMembers(projectId)` | Returns array of `{uid, email, displayName, isOwner}` for all members |

### Flow
1. User enters email in ProjectSharing modal
2. `lookupUserByEmail()` finds the user in `users` collection (they must have signed in at least once)
3. `arrayUnion(uid)` adds them to the project's `members` array
4. Firestore rules + Storage rules check membership for all access
