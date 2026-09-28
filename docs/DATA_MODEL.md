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
| name | string | Project name — shown in the project list, the Word running header, and the document title. Linked to the Project Metadata field in the UI: renaming there + Save renames the project |
| company | string | Client company, used in the exported document title ("Winterberry Group -- [Company] [Project] [Type] Call Notes -- DD Month YYYY") |
| userId | string | Creator's UID (legacy field) |
| ownerId | string | Owner's UID |
| members | string[] | Array of member UIDs (includes owner) |
| createdAt | Timestamp | Creation time |
| updatedAt | Timestamp | Last update time |
| presets | map | `{ management, customer, expert }` — one saved parameter set per call type (see below) |

Each entry in `presets` holds the full parameter set for that call type:

| Preset field | Type | Description |
|-------|------|-------------|
| takeawaysGuidance | string | Key Takeaways topical guidance text ("" = auto-detect) |
| takeawayPreset | string | "customer", "management", or "auto" |
| detailLevel | string | Takeaway detail level (e.g., "balanced") |
| quantCategories | array | Quant categories `[{name, scale}]` ([] = auto-detect) |
| includeImportance | boolean | Include an `Importance:` rating line before each quant Score (N/A when not asked) |
| coverageLevel | string | "focused", "thorough", or "exhaustive" |
| takeawayBullet | string | Bullet character for takeaways |
| discussionBullet | string | Bullet character for discussion |
| formality | string | "standard" or "formal" |
| discussionQuestionFormat | string | "questions" or "statements" |
| customStyleInstructions | string | Free-text custom style instructions |
| projectContext | string | Who-is-who / focus context passed to the prompt |
| wgAttendees | string[] | Selected WG team initials for the "WG Attendees:" line |

Presets are only written when the user hits **Save Preset** (no auto-save). Legacy projects that still carry the old flat settings fields (takeawaysGuidance etc. directly on the doc) are migrated lazily on first load: all three presets are seeded from the flat fields and written back via `migrateProjectToPresets()` in `services/presets.js`. The flat fields are left in place but are no longer read or written.

**Security**: Any authenticated user can create. Read/update/delete requires `request.auth.uid` to be in `members[]` or equal to `userId`.

---

### `projects/{projectId}/transcripts | formattedNotes | masterDocs` (retired)
These subcollections (and their Firebase Storage blobs under `projects/{projectId}/...`) belonged to the removed Project Files browser and cloud master-doc feature. No code reads or writes them anymore; existing documents are orphaned but harmless. The Firestore/Storage rules for them remain in place.

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
