import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  convertInchesToTwip,
  LevelFormat,
  AlignmentType,
  Packer,
  Header,
  ImageRun,
  Tab,
  TabStopType,
  LineRuleType,
} from 'docx'
import { saveAs } from 'file-saver'
import { mergeDocxBlobs } from './docxMerge'
import { CALL_TYPE_LABELS } from './presets'
import { parseRespondentInfo } from './claude'
// "?inline" makes Vite bundle the logo as a base64 data URL, so the header
// image can never be lost to a failed asset fetch (dev, deployed, or offline)
import logoDataUrl from '../assets/logo-horizontal-winterberrygroup-red.png?inline'

// Default configuration matching the WG notes template: Open Sans body at 12pt,
// title as a black Open Sans 14pt Heading 1, Segoe UI 12pt bold running header
const DEFAULT_CONFIG = {
  title: { font: 'Open Sans', size: 14, bold: true, color: '000000' },
  meta: { font: 'Open Sans', size: 12 },
  section_header: { font: 'Open Sans', size: 12, bold: true, underline: true },
  takeaway_bullet: { font: 'Open Sans', size: 12, bullet: '•', indent: 0.5 },
  discussion_question: { font: 'Open Sans', size: 12, bold: true, italic: true },
  discussion_bullet: { font: 'Open Sans', size: 12, bullet: '•', indent: 0.5 },
  quant_header: { font: 'Open Sans', size: 12, bold: true, italic: true },
  quant_category: { font: 'Open Sans', size: 12, bold: true },
  quant_bullet: { font: 'Open Sans', size: 12, bullet: '•', indent: 0.5 },
  running_header: { font: 'Segoe UI', size: 12, bold: true },
}

// Template paragraph spacing: After 8pt (160 twips), line spacing Multiple 1.16
// (278 = 1.16 x 240 with lineRule AUTO), applied uniformly to every paragraph.
// "Don't add space between paragraphs of the same style" is unchecked, which is
// Word's default — contextualSpacing is simply never set.
// Applied as direct formatting (not only styles.xml) so the values survive
// merges into documents whose own styles differ.
const BODY_SPACING = { after: 160, line: 278, lineRule: LineRuleType.AUTO }

const SPACING = {
  title: { ...BODY_SPACING },
  meta: { ...BODY_SPACING },
  sectionHeader: { ...BODY_SPACING },
  question: { ...BODY_SPACING },
  quantCategory: { ...BODY_SPACING },
  bullet: { ...BODY_SPACING },
}

// Numbering reference IDs for native Word bullets
const NUMBERING_REFS = {
  takeaway: 'takeaway-bullets',
  discussion: 'discussion-bullets',
  quant: 'quant-bullets',
}

// Markdown bullet markers we accept from the model / older saved outputs
const BULLET_LINE_RE = /^([-*•●○■➢–])\s+/

// Create numbering config for native Word bullets. Each list uses the configured
// bullet character as its glyph, so every style exports as a real Word list
// (Enter in Word continues the bullet) rather than a text character.
function createNumberingConfig(config = DEFAULT_CONFIG) {
  const refs = [
    { reference: NUMBERING_REFS.takeaway, style: config.takeaway_bullet || DEFAULT_CONFIG.takeaway_bullet },
    { reference: NUMBERING_REFS.discussion, style: config.discussion_bullet || DEFAULT_CONFIG.discussion_bullet },
    { reference: NUMBERING_REFS.quant, style: config.quant_bullet || DEFAULT_CONFIG.quant_bullet },
  ]

  return refs.map(({ reference, style }) => ({
    reference,
    levels: [{
      level: 0,
      format: LevelFormat.BULLET,
      text: style.bullet || '•',
      alignment: AlignmentType.LEFT,
      style: {
        paragraph: {
          indent: { left: 720, hanging: 360 },
        },
      },
    }],
  }))
}

// Remove trailing period from bullet point text. Applied to Discussion and
// Quantitative bullets only — Key Takeaways keep normal sentence punctuation.
function removeTrailingPeriod(text) {
  return text.replace(/\.\s*$/, '').trim()
}

function createTextRun(text, style) {
  const options = {
    text,
    font: style.font || 'Open Sans',
    size: (style.size || 12) * 2, // docx uses half-points
    bold: style.bold || false,
    italics: style.italic || false,
    underline: style.underline ? {} : undefined,
  }

  if (style.color) {
    const color = style.color.replace('#', '')
    options.color = color
  }

  return new TextRun(options)
}

// All bullets are native Word list paragraphs (numbering reference), so Word
// treats them as real bullets: pressing Enter continues the list, indentation
// behaves normally, and spacing is uniform across sections.
function createNativeBulletParagraph(numberingRef, text, style, { keepTrailingPeriod = false } = {}) {
  const strippedMarkdown = text.replace(/\*\*/g, '')
  const cleanText = keepTrailingPeriod ? strippedMarkdown.trim() : removeTrailingPeriod(strippedMarkdown)

  return new Paragraph({
    children: [
      new TextRun({
        text: cleanText,
        font: style.font || 'Open Sans',
        size: (style.size || 12) * 2,
        bold: style.textBold || false,
      }),
    ],
    numbering: {
      reference: numberingRef,
      level: 0,
    },
    spacing: SPACING.bullet,
  })
}

// Score/Reason bullets: same native list as other bullets, with a bold label run
function createQuantLabelBulletParagraph(label, value, style) {
  const cleanValue = removeTrailingPeriod(value)

  return new Paragraph({
    children: [
      new TextRun({
        text: label + ' ',
        font: style.font || 'Open Sans',
        size: (style.size || 12) * 2,
        bold: true,
      }),
      new TextRun({
        text: cleanValue,
        font: style.font || 'Open Sans',
        size: (style.size || 12) * 2,
      }),
    ],
    numbering: {
      reference: NUMBERING_REFS.quant,
      level: 0,
    },
    spacing: SPACING.bullet,
  })
}

// ---- Running header (logo + "[Project name]: [Type of Call] Notes") ----

// The bundled logo, decoded from the inlined data URL once and cached
let cachedLogo = null
function getLogo() {
  if (!cachedLogo) {
    const base64 = logoDataUrl.slice(logoDataUrl.indexOf(',') + 1)
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    cachedLogo = { bytes, ...readPngDimensions(bytes) }
  }
  return cachedLogo
}

// PNG stores width/height as big-endian uint32s at bytes 16-23 (IHDR chunk),
// so a swapped logo asset scales correctly without touching this code
function readPngDimensions(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.byteLength >= 24) {
    const width = view.getUint32(16)
    const height = view.getUint32(20)
    if (width > 0 && height > 0) return { width, height }
  }
  return { width: 4216, height: 1343 } // current logo asset dimensions as fallback
}

// ~0.46" tall in the header, matching the template's logo proportions
const HEADER_LOGO_HEIGHT_PX = 44

// "[Project name]: [Type of Call] Notes" — shared with the on-screen preview
export function buildHeaderText(noteMeta) {
  const label = CALL_TYPE_LABELS[noteMeta?.callType] || 'Expert'
  const projectName = (noteMeta?.projectName || '').trim()
  return projectName ? `${projectName}: ${label} Notes` : `${label} Notes`
}

// Document title (also the export filename):
// "Winterberry Group -- [COMPANY] [PROJECT] [Type] Call Notes -- DD Month YYYY"
// Company and project come from the project metadata; empty parts drop out.
export function buildDocumentTitle(noteMeta) {
  const label = CALL_TYPE_LABELS[noteMeta?.callType] || 'Expert'
  const middle = [noteMeta?.company, noteMeta?.projectName, label]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(' ')
  const datePart = formatTitleDate(noteMeta?.interviewDate)
  return `Winterberry Group -- ${middle} Call Notes${datePart ? ` -- ${datePart}` : ''}`
}

// "DD Month YYYY" (e.g. "05 September 2026") from the YYYY-MM-DD date input,
// built from split parts to avoid the UTC-parse off-by-one
function formatTitleDate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || '')
  if (!match) return ''
  const monthName = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    .toLocaleDateString('en-US', { month: 'long' })
  return `${match[3]} ${monthName} ${match[1]}`
}

function createRunningHeader(noteMeta, logo, config = DEFAULT_CONFIG) {
  const style = config.running_header || DEFAULT_CONFIG.running_header
  const children = [
    new TextRun({
      text: buildHeaderText(noteMeta),
      font: style.font,
      size: style.size * 2,
      bold: style.bold,
    }),
  ]

  if (logo) {
    children.push(new TextRun({ children: [new Tab()] }))
    children.push(
      new ImageRun({
        type: 'png',
        data: logo.bytes,
        transformation: {
          width: Math.round(HEADER_LOGO_HEIGHT_PX * (logo.width / logo.height)),
          height: HEADER_LOGO_HEIGHT_PX,
        },
      })
    )
  }

  return new Header({
    children: [
      new Paragraph({
        // Right tab stop at the 6.5" text width (letter page, 1" margins)
        // pushes the logo flush to the right margin on the same line
        tabStops: [{ type: TabStopType.RIGHT, position: convertInchesToTwip(6.5) }],
        spacing: { after: 120, line: 240, lineRule: LineRuleType.AUTO },
        children,
      }),
    ],
  })
}

// ---- Metadata block (Date / [Company] Attendees / WG Attendees) ----

// <input type="date"> gives YYYY-MM-DD. Build the Date from split parts —
// new Date('2026-09-28') parses as UTC midnight and renders as the previous
// day in US timezones.
function formatInterviewDate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || '')
  if (!match) return isoDate || ''
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// The [label, value] rows under the title. Shared with FormattedPreview so the
// on-screen preview and the .docx can never drift. All three template rows are
// always emitted — an empty value leaves the line ready to fill in Word.
export function buildMetaRows(noteMeta) {
  if (!noteMeta) return []

  const attendees = [noteMeta.respondentName, ...(noteMeta.extraAttendees || [])]
    .map((name) => (name || '').trim())
    .filter(Boolean)
  const companyLabel = (noteMeta.companyLabel || '').trim() || 'Company'

  return [
    ['Date:', formatInterviewDate(noteMeta.interviewDate)],
    [`${companyLabel} Attendees:`, attendees.join(', ')],
    ['WG Attendees:', (noteMeta.wgAttendees || []).join(', ')],
  ]
}

function createMetaParagraphs(noteMeta, config = DEFAULT_CONFIG) {
  const style = config.meta || DEFAULT_CONFIG.meta
  return buildMetaRows(noteMeta).map(
    ([label, value]) =>
      new Paragraph({
        children: [
          new TextRun({
            text: value ? `${label} ` : label,
            font: style.font,
            size: style.size * 2,
            bold: true,
          }),
          ...(value
            ? [
                new TextRun({
                  text: value,
                  font: style.font,
                  size: style.size * 2,
                }),
              ]
            : []),
        ],
        spacing: SPACING.meta,
      })
  )
}

// When the respondent fields are empty (auto-detect not yet applied, or state
// out of sync), fall back to the note's own "### Name, Role, Company" title so
// the speaker always appears on the "[Company] Attendees:" line
export function enrichNoteMetaFromContent(noteMeta, markdownText) {
  if (!noteMeta || !markdownText) return noteMeta
  const hasName = (noteMeta.respondentName || '').trim()
  const hasCompany = (noteMeta.companyLabel || '').trim()
  if (hasName && hasCompany) return noteMeta

  const detected = parseRespondentInfo(markdownText)
  return {
    ...noteMeta,
    respondentName: hasName || detected.name,
    companyLabel: hasCompany || detected.company,
  }
}

export function parseMarkdownToDocx(markdownText, config = DEFAULT_CONFIG, noteMeta = null) {
  noteMeta = enrichNoteMetaFromContent(noteMeta, markdownText)
  const paragraphs = []

  const lines = markdownText.trim().split('\n')
  let currentSection = null
  let metaInserted = !noteMeta
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()

    // Skip empty lines and separators
    if (!line || line === '---') {
      i++
      continue
    }

    // Title: ### Name, Role, Company
    if (line.startsWith('### ') || (i < 3 && line.includes(',') && !line.startsWith('-') && !line.startsWith('*'))) {
      const titleText = line.replace('### ', '').replace(/\*\*/g, '').trim()
      const titleStyle = config.title || DEFAULT_CONFIG.title

      // Heading 1 is a real embedded Word style (shows in the nav pane); the
      // explicit run keeps the look when merged into a doc with other styles
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [createTextRun(titleText, titleStyle)],
          spacing: SPACING.title,
        })
      )
      if (!metaInserted) {
        paragraphs.push(...createMetaParagraphs(noteMeta, config))
        metaInserted = true
      }
      i++
      continue
    }

    // Key Takeaways header
    if (
      (line.includes('Key Takeaways') && (line.includes('**') || line.includes('Takeaways:'))) ||
      line === '**Key Takeaways:**' ||
      line === 'Key Takeaways:'
    ) {
      currentSection = 'takeaways'
      const headerStyle = config.section_header || DEFAULT_CONFIG.section_header

      paragraphs.push(
        new Paragraph({
          children: [createTextRun('Key Takeaways:', headerStyle)],
          spacing: SPACING.sectionHeader,
        })
      )
      i++
      continue
    }

    // Discussion header
    if (
      (line.includes('Discussion') && (line.includes('**') || line.includes('Discussion:'))) ||
      line === '**Discussion:**' ||
      line === 'Discussion:' ||
      line === '**Discussion Summary:**'
    ) {
      currentSection = 'discussion'
      const headerStyle = config.section_header || DEFAULT_CONFIG.section_header

      paragraphs.push(
        new Paragraph({
          children: [createTextRun('Discussion:', headerStyle)],
          spacing: SPACING.sectionHeader,
        })
      )
      i++
      continue
    }

    // Quantitative header
    if (line.includes('Quantitative') && (line.includes('Question') || line.includes('Score') || line.toLowerCase().includes('rate'))) {
      currentSection = 'quantitative'
      const quantText = line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/###/g, '').trim()
      const quantHeaderStyle = config.quant_header || DEFAULT_CONFIG.quant_header

      paragraphs.push(
        new Paragraph({
          children: [createTextRun(quantText, quantHeaderStyle)],
          spacing: SPACING.sectionHeader,
        })
      )
      i++
      continue
    }

    // Discussion question (bold + italic in markdown: ***)
    // Check for *** pattern in any section (questions can appear after quant scores)
    if (line.startsWith('***') || line.startsWith('**_') || line.startsWith('_**')) {
      const questionText = line.replace(/\*\*\*/g, '').replace(/\*\*/g, '').replace(/_/g, '').replace(/\*/g, '').trim()
      const questionStyle = config.discussion_question || DEFAULT_CONFIG.discussion_question

      // If we encounter a discussion question while in quantitative section,
      // this is a post-quant question - treat it as discussion
      paragraphs.push(
        new Paragraph({
          children: [createTextRun(questionText, questionStyle)],
          spacing: SPACING.question,
        })
      )
      i++
      continue
    }

    // Quantitative category (bold text like **Overall Satisfaction**)
    if (currentSection === 'quantitative' && line.startsWith('**') && line.endsWith('**') && !line.includes('Score')) {
      const categoryText = line.replace(/\*\*/g, '').trim()
      const categoryStyle = config.quant_category || DEFAULT_CONFIG.quant_category

      paragraphs.push(
        new Paragraph({
          children: [createTextRun(categoryText, categoryStyle)],
          spacing: SPACING.quantCategory,
        })
      )
      i++
      continue
    }

    // Catch quantitative category names without markdown
    if (currentSection === 'quantitative' && !BULLET_LINE_RE.test(line)) {
      const categoryNames = [
        'Overall Satisfaction',
        'Quality, Accuracy',
        'Quality, Timeliness',
        'Innovative Thinking',
        'Quality of Account',
        'Net Promoter',
        'Ease of Doing Business',
        'Breadth of Capabilities',
      ]
      if (categoryNames.some((cat) => line.includes(cat))) {
        const categoryText = line.replace(/\*\*/g, '').trim()
        const categoryStyle = config.quant_category || DEFAULT_CONFIG.quant_category

        paragraphs.push(
          new Paragraph({
            children: [createTextRun(categoryText, categoryStyle)],
            spacing: SPACING.quantCategory,
          })
        )
        i++
        continue
      }
    }

    // Bullet points (accept -, *, and legacy bullet glyphs from older outputs)
    if (BULLET_LINE_RE.test(line)) {
      const bulletText = line.replace(BULLET_LINE_RE, '').trim()

      if (currentSection === 'takeaways') {
        const style = config.takeaway_bullet || DEFAULT_CONFIG.takeaway_bullet
        paragraphs.push(createNativeBulletParagraph(NUMBERING_REFS.takeaway, bulletText, style, { keepTrailingPeriod: true }))
      } else if (currentSection === 'quantitative') {
        const style = config.quant_bullet || DEFAULT_CONFIG.quant_bullet

        if (bulletText.startsWith('**Importance:**') || bulletText.startsWith('Importance:')) {
          const importanceValue = bulletText.replace('**Importance:**', '').replace('Importance:', '').trim()
          paragraphs.push(createQuantLabelBulletParagraph('Importance:', importanceValue, style))
        } else if (bulletText.startsWith('**Score:**') || bulletText.startsWith('Score:')) {
          const scoreValue = bulletText.replace('**Score:**', '').replace('Score:', '').trim()
          paragraphs.push(createQuantLabelBulletParagraph('Score:', scoreValue, style))
        } else if (bulletText.startsWith('**Reason:**') || bulletText.startsWith('Reason:')) {
          const reasonValue = bulletText.replace('**Reason:**', '').replace('Reason:', '').trim()
          paragraphs.push(createQuantLabelBulletParagraph('Reason:', reasonValue, style))
        } else {
          paragraphs.push(createNativeBulletParagraph(NUMBERING_REFS.quant, bulletText, style))
        }
      } else {
        // Discussion or default
        const style = config.discussion_bullet || DEFAULT_CONFIG.discussion_bullet
        paragraphs.push(createNativeBulletParagraph(NUMBERING_REFS.discussion, bulletText, style))
      }

      i++
      continue
    }

    // Fallback: regular paragraph
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '').trim(),
            font: DEFAULT_CONFIG.meta.font,
            size: DEFAULT_CONFIG.meta.size * 2,
          }),
        ],
        spacing: { ...BODY_SPACING },
      })
    )
    i++
  }

  // Output with no recognizable title line: put the metadata block first
  if (!metaInserted) {
    paragraphs.unshift(...createMetaParagraphs(noteMeta, config))
  }

  return paragraphs
}

// Sanitize filename by replacing invalid characters with underscores
function sanitizeFilename(str) {
  if (!str || !str.trim()) return 'Unknown'
  return str.trim().replace(/[/\\?%*:|"<>]/g, '_')
}

// The one place per-user options become an export config — callers pass their
// bullet glyph choices here instead of rebuilding DEFAULT_CONFIG spreads.
export function buildExportConfig({ takeawayBullet, discussionBullet } = {}) {
  return {
    ...DEFAULT_CONFIG,
    takeaway_bullet: { ...DEFAULT_CONFIG.takeaway_bullet, bullet: takeawayBullet || '•' },
    discussion_bullet: { ...DEFAULT_CONFIG.discussion_bullet, bullet: discussionBullet || '•' },
    quant_bullet: { ...DEFAULT_CONFIG.quant_bullet, bullet: discussionBullet || '•' },
  }
}

// Build a complete .docx blob from formatted markdown. This is the ONLY correct
// way to turn output into a document: it always includes the numbering config
// (without it, bullet paragraphs reference lists that don't exist and Word does
// not render them as bullets), standard 1" margins, and the template styles.
// When noteMeta is provided, the doc also gets the WG running header (logo +
// "[Project name]: [Type of Call] Notes") and the Date/Attendees block.
// Blobs destined for a merge need no special handling — mergeDocxBlobs remaps
// list IDs so appended bullets stay live without touching the target's lists.
export async function buildDocxBlob(markdownText, config = DEFAULT_CONFIG, noteMeta = null) {
  const logo = noteMeta ? getLogo() : null
  const paragraphs = parseMarkdownToDocx(markdownText, config, noteMeta)

  const doc = new Document({
    ...(noteMeta ? { title: buildDocumentTitle(noteMeta) } : {}),
    styles: {
      default: {
        document: {
          run: { font: 'Open Sans', size: 24 }, // half-points: 12pt
          paragraph: { spacing: { ...BODY_SPACING } },
        },
        // Real embedded Heading 1 — black instead of Word's default blue
        heading1: {
          run: { font: 'Open Sans', size: 28, bold: true, color: '000000' },
          paragraph: { spacing: { ...BODY_SPACING } },
        },
      },
    },
    numbering: {
      config: createNumberingConfig(config),
    },
    sections: [
      {
        ...(noteMeta ? { headers: { default: createRunningHeader(noteMeta, logo, config) } } : {}),
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        children: paragraphs,
      },
    ],
  })

  return Packer.toBlob(doc)
}

export async function exportToWord(markdownText, options = {}) {
  const { mode = 'new', existingFile = null, config = DEFAULT_CONFIG, respondentInfo = {}, noteMeta = null } = options

  if (mode === 'append' && existingFile) {
    // Read existing file and inject the new content into it
    const existingArrayBuffer = await existingFile.arrayBuffer()

    const newBlob = await buildDocxBlob(markdownText, config, noteMeta)
    const newArrayBuffer = await newBlob.arrayBuffer()

    const mergedBlob = await mergeDocxBlobs(existingArrayBuffer, newArrayBuffer)

    // Use original filename with _updated suffix
    const originalName = existingFile.name.replace('.docx', '')
    const filename = `${originalName}_updated.docx`
    saveAs(mergedBlob, filename)
    return filename
  }

  // New document mode
  const blob = await buildDocxBlob(markdownText, config, noteMeta)

  let filename
  if (noteMeta) {
    // Document-title filename: "Winterberry Group -- ... Call Notes -- DD Month YYYY.docx"
    filename = `${sanitizeFilename(buildDocumentTitle(noteMeta))}.docx`
  } else {
    // Legacy fallback: Name_Role_Company_Notes_YYYY-MM-DD.docx
    const name = sanitizeFilename(respondentInfo.name)
    const role = sanitizeFilename(respondentInfo.role)
    const company = sanitizeFilename(respondentInfo.company)
    const date = new Date().toISOString().slice(0, 10)
    filename = `${name}_${role}_${company}_Notes_${date}.docx`
  }

  saveAs(blob, filename)
  return { filename }
}

export { DEFAULT_CONFIG }
