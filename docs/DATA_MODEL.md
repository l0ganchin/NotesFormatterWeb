# Data Model & Security Rules

## Firestore Collections

### `users/{userId}`
User profile document, created/updated on sign-in via `upsertUserProfile()`.

| Field | Type | Description |
|-------|------|-------------|
| email | string | User's email address |
| displayName | string | Display name from OAuth provider |
| photoURL | string | Avatar URL from OAuth provider |
| updatedAt | Timestamp | Last profile update |

**Security**: Any authenticated user can read (needed for sharing lookups). Only the owner can write.

---

### `users/{userId}/presets/{presetId}`
Legacy preset storage. **Superseded by top-level `projects` collection.** Existing presets are auto-migrated to projects on first load via `migrateLegacyPresets()`.

---

### `projects/{projectId}`
Top-level project document. Projects are the primary organizational unit.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Document ID (auto-generated) |
| name | string | Project display name |
| userId | string | Creator's UID (legacy field) |
| ownerId | string | Owner's UID |
| members | string[] | Array of member UIDs (includes owner) |
| createdAt | Timestamp | Creation time |
| updatedAt | Timestamp | Last update time |
| takeawaysGuidance | string | Saved Key Takeaways topical guidance text |
| takeawayPreset | string | "customer" or "management" |
| quantCategories | array | Saved quant categories `[{name, scale}]` |
| coverageLevel | string | "focused", "thorough", or "exhaustive" |
| takeawayBullet | string | Bullet character for takeaways |
| discussionBullet | string | Bullet character for discussion |
| formality | string | "standard" or "formal" |
| discussionQuestionFormat | string | "questions" or "statements" |
| customStyleInstructions | string | Free-text custom style instructions |

**Security**: Any authenticated user can create. Read/update/delete requires `request.auth.uid` to be in `members[]` or equal to `userId`.

---

### `projects/{projectId}/transcripts/{transcriptId}`
Metadata for uploaded transcript files.

| Field | Type | Description |
|-------|------|-------------|
| fileName | string | Display filename (e.g., "Bobby_CEO_Acme_Transcript.docx") |
| respondentName | string | Respondent name |
| respondentRole | string | Respondent role/title |
| respondentCompany | string | Respondent company |
| uploadedBy | string | UID of uploader |
| uploadedByName | string | Display name of uploader |
| createdAt | Timestamp | Upload time |
| storagePath | string | Firebase Storage path (e.g., "projects/abc/transcripts/xyz.docx") |
| fileSizeBytes | number | File size in bytes |

---

### `projects/{projectId}/formattedNotes/{noteId}`
Metadata for saved formatted note files.

| Field | Type | Description |
|-------|------|-------------|
| fileName | string | Display filename (e.g., "Bobby_CEO_Acme_Notes_2025-01-15.docx") |
| respondentName | string | Respondent name |
| respondentRole | string | Respondent role/title |
| respondentCompany | string | Respondent company |
| sourceTranscriptId | string | ID of source transcript (if applicable) |
| createdBy | string | UID of creator |
| createdByName | string | Display name of creator |
| createdAt | Timestamp | Creation time |
| storagePath | string | Firebase Storage path |
| fileSizeBytes | number | File size in bytes |

---

### `projects/{projectId}/masterDocs/{masterDocId}`
Metadata for master documents (aggregated multi-interview docs).

| Field | Type | Description |
|-------|------|-------------|
| name | string | Master document display name (without .docx) |
| fileName | string | Sanitized filename with .docx extension |
| createdBy | string | UID of creator |
| createdByName | string | Display name of creator |
| createdAt | Timestamp | Creation time |
| updatedAt | Timestamp | Last update (last append) |
| lastAppendedBy | string | UID of last user to append |
| appendCount | number | Number of notes appended (starts at 1 on creation) |
| storagePath | string | Firebase Storage path |
| fileSizeBytes | number | Current file size in bytes |

---

## Firebase Storage Paths

All files are stored under the `projects/` prefix:

```
projects/{projectId}/transcripts/{transcriptId}.docx
projects/{projectId}/formattedNotes/{noteId}.docx
projects/{projectId}/masterDocs/{masterDocId}.docx
```

**Download method**: `getDownloadURL()` returns a signed URL, then `fetch()` retrieves the blob. This requires CORS to be configured on the storage bucket (see `cors.json`).

**Security**: Storage rules cross-reference Firestore to check project membership. Requires Firebase Blaze plan for `firestore.get()` in storage rules.

---

## Security Rules Summary

### Firestore (`firestore.rules`)
```
users/{userId}                  → read: any auth user; write: owner only
users/{userId}/presets/**       → read/write: owner only
projects/{projectId}            → create: any auth user; read/update/delete: members or owner
projects/{projectId}/{sub}/{id} → read/write: project members (checked via get() on parent)
```

### Storage (`storage.rules`)
```
projects/{projectId}/**         → read/write: project members (checked via firestore.get())
```

The subcollection rules use `get()` to look up the parent project document and verify the requesting user's UID is in the `members` array. This is the key access control mechanism that enables project sharing.

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| VITE_CLAUDE_API_KEY | Anthropic API key for Claude API calls |

The API key is read via `import.meta.env.VITE_CLAUDE_API_KEY` in `App.jsx` and passed to `formatNotes()`. The Claude API call includes the `anthropic-dangerous-direct-browser-access` header to allow direct browser requests.

---

## Firebase Configuration

Defined in `firebase.js`:
- **Project ID**: `wg-note-formatter-vf`
- **Storage Bucket**: `wg-note-formatter-vf.firebasestorage.app`
- **Auth Domain**: `wg-note-formatter-vf.firebaseapp.com`
- **Microsoft Tenant**: `c29afe05-358b-4330-94ad-d661e8b87a48` (Azure AD tenant for org sign-in)
