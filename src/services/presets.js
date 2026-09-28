// Project presets: each project stores one saved parameter set per call type
// (Management / Customer / Expert). The active pill in the UI selects which
// preset is loaded, and doubles as the "Type of Call" in the exported header.
import { getDefaultTakeawaysGuidance } from './claude'

export const PRESET_KEYS = ['management', 'customer', 'expert']

export const CALL_TYPE_LABELS = {
  management: 'Management',
  customer: 'Customer',
  expert: 'Expert',
}

// Full WG team roster for the "WG Attendees:" line, in canonical output order
export const WG_TEAM = ['BB', 'MH', 'JM', 'CP', 'IS', 'BT', 'KR', 'TK', 'JW', 'ER', 'RD', 'LC', 'GN', 'KO', 'AM', 'SD', 'MK']

// Management takeaways template (the customer template's single source of
// truth is getDefaultTakeawaysGuidance in claude.js)
export const MANAGEMENT_TAKEAWAYS_GUIDANCE = `- [Their domain/role and perspective on company trajectory]
- [Key operational insights from their area]
- [Strategic challenges or opportunities they see]
- [Growth initiatives or investment priorities]
- [Optional fifth bullet for additional context or caveats]`

export const DEFAULT_CUSTOM_STYLE_INSTRUCTIONS = 'Please be exhaustive and detailed, drawing on the source material. Include all details valuable to the conversation. Rewrite bullets as full sentences with added context so someone who didn\'t attend the call can easily follow. Full sentences only, formal language. Neutral in tone. Make at least 6 pages as content allows.'

// Ordered key list — collectors and normalizers build presets through this so
// JSON.stringify comparisons (dirty checks) never trip on key order
const PRESET_FIELDS = [
  'takeawaysGuidance',
  'takeawayPreset',
  'detailLevel',
  'quantCategories',
  'includeImportance',
  'coverageLevel',
  'takeawayBullet',
  'discussionBullet',
  'formality',
  'discussionQuestionFormat',
  'customStyleInstructions',
  'projectContext',
  'wgAttendees',
]

export function buildDefaultPreset(callType) {
  const base = {
    takeawaysGuidance: getDefaultTakeawaysGuidance(),
    takeawayPreset: 'customer',
    detailLevel: 'balanced',
    quantCategories: [],
    includeImportance: false,
    coverageLevel: 'exhaustive',
    takeawayBullet: '•',
    discussionBullet: '•',
    formality: 'standard',
    discussionQuestionFormat: 'questions',
    customStyleInstructions: DEFAULT_CUSTOM_STYLE_INSTRUCTIONS,
    projectContext: '',
    wgAttendees: [],
  }

  if (callType === 'management') {
    base.takeawaysGuidance = MANAGEMENT_TAKEAWAYS_GUIDANCE
    base.takeawayPreset = 'management'
  } else if (callType === 'expert') {
    // Expert calls vary too much for a fixed template — start in auto-detect
    base.takeawaysGuidance = ''
    base.takeawayPreset = 'auto'
  }

  return base
}

// Return a preset with exactly the known fields, in canonical order, filling
// anything missing from the call type's defaults
export function normalizePreset(preset, callType) {
  const defaults = buildDefaultPreset(callType)
  const normalized = {}
  for (const field of PRESET_FIELDS) {
    normalized[field] = preset?.[field] ?? defaults[field]
  }
  return normalized
}

export function buildAllDefaultPresets() {
  return {
    management: buildDefaultPreset('management'),
    customer: buildDefaultPreset('customer'),
    expert: buildDefaultPreset('expert'),
  }
}

// Migrate a pre-preset project (flat settings on the project doc) to the
// presets shape. The old single settings bundle seeds all three presets
// identically so whichever call type the team was using keeps its behavior.
export function migrateProjectToPresets(project) {
  const flat = {}
  for (const field of PRESET_FIELDS) {
    if (project?.[field] !== undefined) flat[field] = project[field]
  }
  const hasFlatSettings = Object.keys(flat).length > 0

  const presets = {}
  for (const key of PRESET_KEYS) {
    presets[key] = hasFlatSettings
      ? normalizePreset(flat, key)
      : buildDefaultPreset(key)
  }
  return presets
}

// Today as YYYY-MM-DD in local time (for <input type="date"> defaults).
// toISOString() would report the UTC date, which is tomorrow/yesterday near
// midnight in US timezones.
export function todayISO() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
