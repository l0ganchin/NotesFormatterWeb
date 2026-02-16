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
   - Follow exact markdown formatting conventions
   - Process the ENTIRE transcript exhaustively
   - Produce Key Takeaways, Discussion, and Quantitative sections

2. **Configurable sections within the prompt**:
   - `buildTakeawaysInstructions()` - Topical guidance + fixed style/quality rules
   - `getFixedTakeawaysRules()` - Detail level (concise/balanced/detailed), naming convention (customer vs management preset)
   - `buildQuantInstructions()` - Manual categories with scales, or auto-detect mode
   - `buildRespondentInstructions()` - Manual respondent info or auto-extract mode
   - `buildCoverageInstructions()` - focused/thorough/exhaustive coverage level

3. **User message** - Simply the raw meeting notes and transcript concatenated

### API Call
| Detail | Value |
|--------|-------|
| Endpoint | `https://api.anthropic.com/v1/messages` |
| Model | `claude-sonnet-4-20250514` |
| Max tokens | 16384 |
| Streaming | Yes (SSE) |
| Auth header | `x-api-key` + `anthropic-dangerous-direct-browser-access` |

### `formatNotes(transcript, notes, apiKey, options)`
Main formatting function. Options include all settings plus:
- `onChunk(partialOutput)` - Callback for streaming updates
- `abortSignal` - AbortController signal for cancellation

Reads the SSE stream, parses `content_block_delta` events, accumulates text, and calls `onChunk` on each delta.

### Output Parsing Functions
| Function | Description |
|----------|-------------|
| `parseQuantCategories(output)` | Extracts quant category names and scales from formatted output |
| `parseRespondentInfo(output)` | Extracts name, role, company from `### Title` line |
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
- `- Bullet text` → Indented bullet (native Word bullet for standard bullet char, text-based for custom chars)
- `**Category Name**` in quant section → Bold category header
- `**Score:**` / `**Reason:**` → Bold label + value
- Page break prefix when `isAppend = true`

### `exportToWord(markdownText, options)`
Exports the formatted output to a .docx file. Two modes:
- **New document**: Creates fresh .docx, saves as `Name_Role_Company_Notes_YYYY-MM-DD.docx`
- **Append to existing**: Reads existing .docx, creates new content, merges with `docx-merger`, saves as `originalname_updated.docx`

### Bullet Handling
- Standard bullet (U+2022) uses native Word numbering (`LevelFormat.BULLET`)
- Custom bullets (circle, square, arrow, dash) use text-based rendering with manual indentation

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
