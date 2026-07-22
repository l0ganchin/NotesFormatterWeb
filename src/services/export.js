import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  convertInchesToTwip,
  LevelFormat,
  AlignmentType,
  Packer,
} from 'docx'
import { saveAs } from 'file-saver'
import { mergeDocxBlobs } from './docxMerge'

// Default configuration matching the Python script
const DEFAULT_CONFIG = {
  title: { font: 'Aptos', size: 14, bold: false, color: '0F4761' },
  section_header: { font: 'Calibri', size: 11, bold: true, underline: true },
  takeaway_bullet: { font: 'Calibri', size: 11, bullet: '\u2022', indent: 0.5 },
  discussion_question: { font: 'Calibri', size: 11, bold: true, italic: true },
  discussion_bullet: { font: 'Calibri', size: 11, bullet: '\u2022', indent: 0.5 },
  quant_header: { font: 'Calibri', size: 11, bold: true, italic: true },
  quant_category: { font: 'Calibri', size: 11, bold: true },
  quant_bullet: { font: 'Calibri', size: 11, bullet: '\u2022', indent: 0.5 },
}

// Single source of truth for paragraph spacing (twips: 20 = 1pt).
// Every bullet in every section uses SPACING.bullet so gaps are uniform.
const SPACING = {
  title: { before: 160, after: 80 },
  sectionHeader: { before: 240, after: 120 },
  question: { before: 200, after: 80 },
  quantCategory: { before: 160, after: 80 },
  bullet: { before: 0, after: 80 },
}

// Numbering reference IDs for native Word bullets
const NUMBERING_REFS = {
  takeaway: 'takeaway-bullets',
  discussion: 'discussion-bullets',
  quant: 'quant-bullets',
}

// Markdown bullet markers we accept from the model / older saved outputs
const BULLET_LINE_RE = /^([-*\u2022\u25cf\u25cb\u25a0\u27a2\u2013])\s+/

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
      text: style.bullet || '\u2022',
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
    font: style.font || 'Calibri',
    size: (style.size || 11) * 2, // docx uses half-points
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
        font: style.font || 'Calibri',
        size: (style.size || 11) * 2,
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
        font: style.font || 'Calibri',
        size: (style.size || 11) * 2,
        bold: true,
      }),
      new TextRun({
        text: cleanValue,
        font: style.font || 'Calibri',
        size: (style.size || 11) * 2,
      }),
    ],
    numbering: {
      reference: NUMBERING_REFS.quant,
      level: 0,
    },
    spacing: SPACING.bullet,
  })
}

export function parseMarkdownToDocx(markdownText, config = DEFAULT_CONFIG) {
  const paragraphs = []

  const lines = markdownText.trim().split('\n')
  let currentSection = null
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

      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [createTextRun(titleText, titleStyle)],
          spacing: SPACING.title,
        })
      )
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
            font: 'Calibri',
            size: 22,
          }),
        ],
      })
    )
    i++
  }

  return paragraphs
}

// Sanitize filename by replacing invalid characters with underscores
function sanitizeFilename(str) {
  if (!str || !str.trim()) return 'Unknown'
  return str.trim().replace(/[/\\?%*:|"<>]/g, '_')
}

// Build a complete .docx blob from formatted markdown. This is the ONLY correct
// way to turn output into a document: it always includes the numbering config
// (without it, bullet paragraphs reference lists that don't exist and Word does
// not render them as bullets) and standard 1" margins.
// Blobs destined for a merge need no special handling — mergeDocxBlobs remaps
// list IDs so appended bullets stay live without touching the target's lists.
export async function buildDocxBlob(markdownText, config = DEFAULT_CONFIG) {
  const paragraphs = parseMarkdownToDocx(markdownText, config)
  const doc = new Document({
    numbering: {
      config: createNumberingConfig(config),
    },
    sections: [
      {
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
  const { mode = 'new', existingFile = null, config = DEFAULT_CONFIG, respondentInfo = {} } = options

  if (mode === 'append' && existingFile) {
    // Read existing file and inject the new content into it
    const existingArrayBuffer = await existingFile.arrayBuffer()

    const newBlob = await buildDocxBlob(markdownText, config)
    const newArrayBuffer = await newBlob.arrayBuffer()

    const mergedBlob = await mergeDocxBlobs(existingArrayBuffer, newArrayBuffer)

    // Use original filename with _updated suffix
    const originalName = existingFile.name.replace('.docx', '')
    const filename = `${originalName}_updated.docx`
    saveAs(mergedBlob, filename)
    return filename
  }

  // New document mode
  const blob = await buildDocxBlob(markdownText, config)

  // Generate filename: Name_Role_Company_Notes_YYYY-MM-DD.docx
  const name = sanitizeFilename(respondentInfo.name)
  const role = sanitizeFilename(respondentInfo.role)
  const company = sanitizeFilename(respondentInfo.company)
  const date = new Date().toISOString().slice(0, 10)
  const filename = `${name}_${role}_${company}_Notes_${date}.docx`

  saveAs(blob, filename)
  return { filename }
}

export { DEFAULT_CONFIG }
