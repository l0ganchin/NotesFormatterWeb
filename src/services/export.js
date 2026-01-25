import {
  Document,
  Paragraph,
  TextRun,
  PageBreak,
  convertInchesToTwip,
  AlignmentType,
} from 'docx'
import { saveAs } from 'file-saver'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
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

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  }
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
    if (currentSection === 'discussion' && (line.startsWith('***') || line.startsWith('**_') || line.startsWith('_**'))) {
      const questionText = line.replace(/\*\*\*/g, '').replace(/\*\*/g, '').replace(/_/g, '').replace(/\*/g, '').trim()
      const questionStyle = config.discussion_question || DEFAULT_CONFIG.discussion_question

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

export async function exportToWord(markdownText, options = {}) {
  const { mode = 'new', existingFile = null, config = DEFAULT_CONFIG } = options

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
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `formatted_notes_${timestamp}.docx`

  saveAs(blob, filename)
  return filename
}

export async function exportToPdf(markdownText, options = {}) {
  const { mode = 'new', existingFile = null } = options

  let pdfDoc
  let appendFilename = null

  if (mode === 'append' && existingFile) {
    // Load existing PDF
    const existingArrayBuffer = await existingFile.arrayBuffer()
    pdfDoc = await PDFDocument.load(existingArrayBuffer)
    appendFilename = existingFile.name.replace('.pdf', '')
  } else {
    pdfDoc = await PDFDocument.create()
  }
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
  const fontBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique)

  // Page dimensions (Letter size in points: 612 x 792)
  const pageWidth = 612
  const pageHeight = 792
  const margin = 72 // 1 inch
  const contentWidth = pageWidth - 2 * margin
  const fontSize = 11
  const lineHeight = fontSize * 1.4
  const titleColor = rgb(15 / 255, 71 / 255, 97 / 255) // #0F4761

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const addNewPage = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight])
    y = pageHeight - margin
  }

  const checkPageBreak = (neededHeight) => {
    if (y - neededHeight < margin) {
      addNewPage()
    }
  }

  // Word wrap helper
  const wrapText = (text, maxWidth, currentFont, currentSize) => {
    const words = text.split(' ')
    const lines = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const testWidth = currentFont.widthOfTextAtSize(testLine, currentSize)

      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) {
      lines.push(currentLine)
    }
    return lines
  }

  const drawText = (text, options = {}) => {
    const {
      size = fontSize,
      currentFont = font,
      color = rgb(0, 0, 0),
      indent = 0,
      spacingBefore = 0,
      spacingAfter = 4,
    } = options

    y -= spacingBefore
    const wrappedLines = wrapText(text, contentWidth - indent, currentFont, size)
    const totalHeight = wrappedLines.length * (size * 1.4) + spacingAfter
    checkPageBreak(totalHeight)

    for (const line of wrappedLines) {
      page.drawText(line, {
        x: margin + indent,
        y: y - size,
        size,
        font: currentFont,
        color,
      })
      y -= size * 1.4
    }
    y -= spacingAfter
  }

  // Parse and render markdown
  const lines = markdownText.trim().split('\n')
  let currentSection = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (!line || line === '---') continue

    // Title
    if (line.startsWith('### ')) {
      const titleText = line.replace('### ', '').replace(/\*\*/g, '').trim()
      drawText(titleText, { size: 14, currentFont: font, color: titleColor, spacingAfter: 8 })
      continue
    }

    // Key Takeaways header
    if (line.includes('Key Takeaways') && (line.includes('**') || line.includes(':'))) {
      currentSection = 'takeaways'
      drawText('Key Takeaways:', { currentFont: fontBold, spacingBefore: 16, spacingAfter: 8 })
      continue
    }

    // Discussion header
    if (line.includes('Discussion') && (line.includes('**') || line.includes(':'))) {
      currentSection = 'discussion'
      drawText('Discussion:', { currentFont: fontBold, spacingBefore: 16, spacingAfter: 8 })
      continue
    }

    // Quantitative header
    if (line.includes('Quantitative') && (line.includes('Question') || line.includes('Score') || line.toLowerCase().includes('rate'))) {
      currentSection = 'quantitative'
      const quantText = line.replace(/\*\*\*/g, '').replace(/\*\*/g, '').replace(/\*/g, '').trim()
      drawText(quantText, { currentFont: fontBoldItalic, spacingBefore: 16, spacingAfter: 8 })
      continue
    }

    // Discussion question
    if ((currentSection === 'discussion' || currentSection === 'quantitative') && line.startsWith('***')) {
      const questionText = line.replace(/\*\*\*/g, '').replace(/\*\*/g, '').replace(/\*/g, '').trim()
      drawText(questionText, { currentFont: fontBoldItalic, spacingBefore: 12, spacingAfter: 6 })
      continue
    }

    // Quantitative category
    if (currentSection === 'quantitative' && line.startsWith('**') && line.endsWith('**') && !line.includes('Score')) {
      const categoryText = line.replace(/\*\*/g, '').trim()
      drawText(categoryText, { currentFont: fontBold, spacingBefore: 10, spacingAfter: 4 })
      continue
    }

    // Bullet points
    if (line.startsWith('- ') || line.startsWith('* ')) {
      let bulletText = line.substring(2).trim().replace(/\*\*/g, '').replace(/\.\s*$/, '')
      const bullet = currentSection === 'takeaways' ? '> ' : '- '
      drawText(bullet + bulletText, { indent: 18, spacingAfter: currentSection === 'quantitative' ? 3 : 5 })
      continue
    }

    // Fallback paragraph
    const plainText = line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '').trim()
    if (plainText) {
      drawText(plainText, { spacingBefore: 4, spacingAfter: 4 })
    }
  }

  const pdfBytes = await pdfDoc.save()
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })

  let filename
  if (appendFilename) {
    filename = `${appendFilename}_updated.pdf`
  } else {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    filename = `formatted_notes_${timestamp}.pdf`
  }

  saveAs(blob, filename)
}


export { DEFAULT_CONFIG }
