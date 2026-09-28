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

**Meeting notes are strictly additive**: they signal emphasis (topics in both notes and transcript get prominence), notes-only content must still be worked into the output, and the notes can never narrow transcript coverage — the transcript is formatted exactly as completely as if no notes were provided.

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
Word document (.docx) generation from Claude's markdown output, in the WG notes template.

### `DEFAULT_CONFIG`
Default styling configuration for generated documents (matches the WG template):
```
title:              Open Sans 14pt, bold, black (real Heading 1 style)
meta:               Open Sans 12pt (Date / Attendees block, bold labels)
section_header:     Open Sans 12pt, bold, underline
takeaway_bullet:    Open Sans 12pt, bullet char, 0.5in indent
discussion_question: Open Sans 12pt, bold, italic
discussion_bullet:  Open Sans 12pt, bullet char, 0.5in indent
quant_header:       Open Sans 12pt, bold, italic
quant_category:     Open Sans 12pt, bold
quant_bullet:       Open Sans 12pt, bullet char, 0.5in indent
running_header:     Segoe UI 12pt, bold
```

### Spacing (`BODY_SPACING` / `SPACING`)
Every paragraph gets the template values as direct formatting: space After 8pt (160 twips), line spacing Multiple 1.16 (`line: 278, lineRule: AUTO`), contextualSpacing off. Direct formatting (not just styles.xml) is deliberate — it survives merges into documents whose own styles differ. `buildDocxBlob` also embeds matching `Document.styles` defaults plus a black Open Sans Heading 1 override, so the title shows in Word's navigation pane without the stock blue.

### Running header (`createRunningHeader`)
When a `noteMeta` object is provided, the document gets a default header on every page: bold Segoe UI 12pt text `"[Project name]: [Type of Call] Notes"` left, and the full WG lockup logo (`src/assets/logo-horizontal-winterberrygroup-red.png`, embedded via `ImageRun`, 44px display height) pushed flush right by a right tab stop at 6.5". The logo is imported with Vite's `?inline` suffix (bundled as a base64 data URL) and decoded synchronously in `getLogo()` — no runtime fetch, so the image can never be dropped by a failed asset request. Its pixel dimensions are read from the PNG's IHDR chunk so swapping the asset rescales automatically (30px display height). `buildHeaderText(noteMeta)` is exported and shared with the preview.

### Metadata block (`buildMetaRows` / `createMetaParagraphs` / `enrichNoteMetaFromContent`)
When `respondentName`/`companyLabel` are empty in `noteMeta`, `enrichNoteMetaFromContent` derives them from the note's own `### Name, Role, Company` title (via `parseRespondentInfo`), so the auto-detected speaker always lands on the Attendees line — in both the export and FormattedPreview.
Directly under the title, three lines with bold labels are injected deterministically (never asked of the LLM): `Date:` (formatted from the date input, built from split Y/M/D parts to avoid the UTC-parse off-by-one), `[Company] Attendees:` (respondent name + extra attendees; label falls back to "Company"), and `WG Attendees:` (selected initials). All three rows always emit — an empty value leaves the line ready to fill in Word. `buildMetaRows(noteMeta)` is exported and shared with FormattedPreview so preview and export can't drift.

### `noteMeta` shape
```
{ projectName, company, callType: 'management'|'customer'|'expert', interviewDate: 'YYYY-MM-DD',
  respondentName, companyLabel, extraAttendees: string[], wgAttendees: string[] }
```
Assembled in App.jsx from the active pill + project metadata + call info inputs. When `noteMeta` is null (legacy callers), the doc has no header and no metadata block. (`company` is the project-level client company for the doc title; `companyLabel` is the respondent's company for the Attendees line.)

### Document title (`buildDocumentTitle`)
`"Winterberry Group -- [Company] [Project] [Type] Call Notes -- DD Month YYYY"` — company/project from project metadata, type from the active pill, date from the date input (empty parts drop out). Used as the new-document filename (sanitized + `.docx`), shown in the ExportModal, and set as the docx core `title` property.

### `parseMarkdownToDocx(markdownText, config, noteMeta)`
Core conversion function. Parses Claude's markdown output line-by-line and creates `docx` library Paragraph/TextRun objects. Handles:
- `### Title` lines → Heading 1 (black, Open Sans 14 bold), followed by the injected metadata block
- `**Key Takeaways:**` → Underlined bold section header
- `**Discussion:**` → Underlined bold section header
- `***Question text***` → Bold italic paragraph
- Bullet lines (`- `, `* `, or legacy glyphs `•●○■➢–` via `BULLET_LINE_RE`) → native Word list bullets
- `**Category Name**` in quant section → Bold category header
- `**Score:**` / `**Reason:**` → native list bullet with bold label run + value (same list as other quant bullets)

If no title line is found, the metadata block is prepended at the top instead.

### `buildExportConfig({ takeawayBullet, discussionBullet })`
The one place per-user options become an export config (bullet glyphs over `DEFAULT_CONFIG`). All callers use this instead of hand-spreading `DEFAULT_CONFIG`.

### `buildDocxBlob(markdownText, config, noteMeta)`
The ONLY correct way to turn formatted output into a .docx blob. Always includes the numbering config (bullet list definitions), the template `Document.styles`, and 1" margins; adds the running header when `noteMeta` is present. Building a `Document` without the numbering config silently breaks bullets in Word.

### `exportToWord(markdownText, options)`
Exports the formatted output to a .docx file. Options: `{ mode, existingFile, config, respondentInfo, noteMeta }`. Two modes:
- **New document**: Creates fresh .docx, saved under the document title (`buildDocumentTitle`); falls back to `Name_Role_Company_Notes_YYYY-MM-DD.docx` when no `noteMeta`
- **Append to existing**: Reads existing .docx, builds merge-compatible content, injects it via `mergeDocxBlobs()`, saves as `originalname_updated.docx`. The appended note's own header is dropped by the merge (headers live in the stripped `sectPr`), so the target document's header — or lack of one — always wins.

### `mergeDocxBlobs(existingArrayBuffer, appendArrayBuffer)` (src/services/docxMerge.js)
Appends generated content into an existing .docx by unzipping it (JSZip) and inserting the new body XML just before the document's closing section properties, preceded by exactly one page break — so the appended text starts on the page after the existing text with no blank page between.

**Bullets stay live Word lists on both sides.** The merge copies the appended document's list definitions into the target's `numbering.xml` under fresh IDs guaranteed not to collide (max existing ID + 1), rewrites the appended body's `numId` references to match, and leaves the target's own definitions byte-for-byte untouched. If the target has no numbering part at all, the appended document's part is installed and wired in (content-type override + relationship).

This replaced `docx-merger`, which renamed merged list definitions WITHOUT updating the paragraphs referencing them — every bullet in a merged document pointed at a missing list and Word "repaired" them into one running numbered list.

### Bullet Handling
- ALL bullet styles export as native Word list bullets (`LevelFormat.BULLET`), using the user-selected glyph as the list's bullet text
- In Word, pressing Enter at the end of any exported bullet continues the list

### Bullet Punctuation
- Key Takeaways bullets keep normal sentence punctuation (trailing periods)
- Discussion and Quantitative bullets (including Reason text) have trailing periods stripped; punctuation inside the bullet is untouched
- The prompt instructs the model to emit this convention; export and preview strip as a safety net for older outputs

---

## `src/services/presets.js`
Call-type presets and defaults (see DATA_MODEL.md for the stored shape).

### Exports
| Export | Description |
|----------|-------------|
| `PRESET_KEYS` / `CALL_TYPE_LABELS` | `['management','customer','expert']` and their display labels (also the "Type of Call" in the Word header) |
| `WG_TEAM` | Canonical roster of WG initials for the WG Attendees picker; output always follows this order |
| `MANAGEMENT_TAKEAWAYS_GUIDANCE` | Management takeaways template (single source of truth; also used by PromptSettings' examples dropdown) |
| `buildDefaultPreset(callType)` | Per-type defaults: management → management guidance/preset, customer → customer template, expert → auto-detect |
| `normalizePreset(preset, callType)` | Returns exactly the known preset fields in canonical key order (missing keys filled from defaults) — dirty checks rely on this ordering for `JSON.stringify` comparison |
| `buildAllDefaultPresets()` | `{ management, customer, expert }` defaults (seeds new projects) |
| `migrateProjectToPresets(project)` | Seeds all three presets from a legacy project's flat settings fields |
| `todayISO()` | Local-time `YYYY-MM-DD` for the date input default (avoids the UTC off-by-one of `toISOString()`) |

---

## `src/services/fileStorage.js` (removed)
Deleted along with the Project Files browser and the cloud master-doc feature. Exporting now only produces standalone .docx downloads or appends to a local file the user picks. The retired Firestore subcollections and Storage paths are documented in DATA_MODEL.md.

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
