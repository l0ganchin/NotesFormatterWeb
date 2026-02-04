import {
  Document,
  Paragraph,
  TextRun,
  PageBreak,
  HeadingLevel,
  convertInchesToTwip,
} from 'docx'
import { saveAs } from 'file-saver'
import DocxMerger from 'docx-merger'

// Default configuration matching the Python script
const DEFAULT_CONFIG = {
  title: { font: 'Aptos', size: 14, bold: false, color: '0F4761' },
  section_header: { font: 'Calibri', size: 11, bold: true, underline: true },
  takeaway_bullet: { font: 'Calibri', size: 11, bullet: '\u27A4', indent: 0.5 },
  discussion_question: { font: 'Calibri', size: 11, bold: true, italic: true },
  discussion_bullet: { font: 'Calibri', size: 11, bullet: '\u2022', indent: 0.5 },
  quant_header: { font: 'Calibri', size: 11, bold: true, italic: true },
  quant_category: { font: 'Calibri', size: 11, bold: true },
  quant_bullet: { font: 'Calibri', size: 11, bullet: '\u2022', indent: 0.5 },
}

// Remove trailing period from bullet point text
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

function createBulletParagraph(bulletChar, text, style, spacingBefore = 0, spacingAfter = 120) {
  const indent = style.indent || 0.5
  const cleanText = removeTrailingPeriod(text.replace(/\*\*/g, ''))

  return new Paragraph({
    children: [
      new TextRun({
        text: bulletChar + '\t',
        font: style.font || 'Calibri',
        size: (style.size || 11) * 2,
      }),
      new TextRun({
        text: cleanText,
        font: style.font || 'Calibri',
        size: (style.size || 11) * 2,
        bold: style.textBold || false,
      }),
    ],
    indent: {
      left: convertInchesToTwip(indent),
      hanging: convertInchesToTwip(0.25),
    },
    spacing: {
      before: spacingBefore,
      after: spacingAfter,
    },
  })
}

function createQuantBulletWithLabel(bulletChar, label, value, style) {
  const indent = style.indent || 0.5
  const cleanValue = removeTrailingPeriod(value)

  return new Paragraph({
    children: [
      new TextRun({
        text: bulletChar + '\t',
        font: style.font || 'Calibri',
        size: (style.size || 11) * 2,
      }),
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
    indent: {
      left: convertInchesToTwip(indent),
      hanging: convertInchesToTwip(0.25),
    },
    spacing: {
      before: 0,
      after: 40,
    },
  })
}

export function parseMarkdownToDocx(markdownText, config = DEFAULT_CONFIG, isAppend = false) {
  const paragraphs = []

  if (isAppend) {
    paragraphs.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    )
  }

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
          spacing: { before: 160, after: 80 },
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
          spacing: { before: 240, after: 120 },
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
          spacing: { before: 240, after: 120 },
        })
      )
      i++
      continue
    }

    // Quantitative header
    if (line.includes('Quantitative') && (line.includes('Question') || line.includes('Score') || line.toLowerCase().includes('rate'))) {
      currentSection = 'quantitative'
      let quantText = line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/###/g, '').trim()
      if (!quantText.endsWith('?')) {
        quantText = 'Quantitative Questions: How would you rate Grapevine?'
      }
      const quantHeaderStyle = config.quant_header || DEFAULT_CONFIG.quant_header

      paragraphs.push(
        new Paragraph({
          children: [createTextRun(quantText, quantHeaderStyle)],
          spacing: { before: 240, after: 120 },
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
          spacing: { before: 200, after: 80 },
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
          spacing: { before: 160, after: 40 },
        })
      )
      i++
      continue
    }

    // Catch quantitative category names without markdown
    if (currentSection === 'quantitative' && !line.startsWith('-') && !line.startsWith('\u2022')) {
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
            spacing: { before: 160, after: 40 },
          })
        )
        i++
        continue
      }
    }

    // Bullet points
    if (line.startsWith('- ') || line.startsWith('\u2022 ') || line.startsWith('* ')) {
      const bulletText = line.substring(2).trim()

      if (currentSection === 'takeaways') {
        const style = config.takeaway_bullet || DEFAULT_CONFIG.takeaway_bullet
        paragraphs.push(createBulletParagraph(style.bullet, bulletText, style, 0, 120))
      } else if (currentSection === 'quantitative') {
        const style = config.quant_bullet || DEFAULT_CONFIG.quant_bullet

        if (bulletText.startsWith('**Score:**') || bulletText.startsWith('Score:')) {
          const scoreValue = bulletText.replace('**Score:**', '').replace('Score:', '').trim()
          paragraphs.push(createQuantBulletWithLabel(style.bullet, 'Score:', scoreValue, style))
        } else if (bulletText.startsWith('**Reason:**') || bulletText.startsWith('Reason:')) {
          const reasonValue = bulletText.replace('**Reason:**', '').replace('Reason:', '').trim()
          paragraphs.push(createQuantBulletWithLabel(style.bullet, 'Reason:', reasonValue, style))
        } else {
          paragraphs.push(createBulletParagraph(style.bullet, bulletText, style, 0, 40))
        }
      } else {
        // Discussion or default
        const style = config.discussion_bullet || DEFAULT_CONFIG.discussion_bullet
        paragraphs.push(createBulletParagraph(style.bullet, bulletText, style, 0, 80))
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

export async function exportToWord(markdownText, options = {}) {
  const { mode = 'new', existingFile = null, config = DEFAULT_CONFIG, respondentInfo = {} } = options

  if (mode === 'append' && existingFile) {
    // Read existing file and merge
    const existingArrayBuffer = await existingFile.arrayBuffer()

    // Create new document content
    const paragraphs = parseMarkdownToDocx(markdownText, config, true) // isAppend = true
    const newDoc = new Document({
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

    const newBlob = await import('docx').then((docx) => docx.Packer.toBlob(newDoc))
    const newArrayBuffer = await newBlob.arrayBuffer()

    // Merge documents
    const merger = new DocxMerger({}, [existingArrayBuffer, newArrayBuffer])
    const mergedBlob = await new Promise((resolve) => {
      merger.save('blob', (data) => resolve(data))
    })

    // Use original filename with _updated suffix
    const originalName = existingFile.name.replace('.docx', '')
    const filename = `${originalName}_updated.docx`
    saveAs(mergedBlob, filename)
    return filename
  }

  // New document mode
  const paragraphs = parseMarkdownToDocx(markdownText, config)
  const doc = new Document({
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

  const blob = await import('docx').then((docx) => docx.Packer.toBlob(doc))

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
