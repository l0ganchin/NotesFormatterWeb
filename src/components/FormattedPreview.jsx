import './FormattedPreview.css'

// Discussion and Quantitative bullets drop their trailing period on export;
// mirror that here so the preview matches the .docx. Takeaways keep periods.
function stripTrailingPeriod(text) {
  return text.replace(/\.\s*$/, '').trim()
}

function parseMarkdownToElements(markdown, takeawayBullet = '\u2022', discussionBullet = '\u2022') {
  if (!markdown) return []

  const lines = markdown.trim().split('\n')
  const elements = []
  let currentSection = null
  let key = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Skip empty lines and separators
    if (!line || line === '---') continue

    // Title: ### Name, Role, Company
    if (line.startsWith('### ')) {
      const titleText = line.replace('### ', '').replace(/\*\*/g, '').trim()
      elements.push(
        <h3 key={key++} className="preview-title">
          {titleText}
        </h3>
      )
      continue
    }

    // Key Takeaways header
    if (
      (line.includes('Key Takeaways') && (line.includes('**') || line.includes(':'))) ||
      line === '**Key Takeaways:**'
    ) {
      currentSection = 'takeaways'
      elements.push(
        <h4 key={key++} className="preview-section-header">
          Key Takeaways:
        </h4>
      )
      continue
    }

    // Discussion header
    if (
      (line.includes('Discussion') && (line.includes('**') || line.includes(':'))) ||
      line === '**Discussion:**'
    ) {
      currentSection = 'discussion'
      elements.push(
        <h4 key={key++} className="preview-section-header">
          Discussion:
        </h4>
      )
      continue
    }

    // Quantitative header
    if (line.includes('Quantitative') && (line.includes('Question') || line.includes('Score') || line.toLowerCase().includes('rate'))) {
      currentSection = 'quantitative'
      let quantText = line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/###/g, '').trim()
      elements.push(
        <p key={key++} className="preview-quant-header">
          {quantText}
        </p>
      )
      continue
    }

    // Discussion question (bold + italic: ***) - check in ANY section
    // Post-quant questions appear while still in 'quantitative' section
    if (line.startsWith('***') || line.startsWith('**_') || line.startsWith('_**')) {
      const questionText = line.replace(/\*\*\*/g, '').replace(/\*\*/g, '').replace(/_/g, '').replace(/\*/g, '').trim()
      elements.push(
        <p key={key++} className="preview-question">
          {questionText}
        </p>
      )
      continue
    }

    // Quantitative category
    if (currentSection === 'quantitative' && line.startsWith('**') && line.endsWith('**') && !line.includes('Score')) {
      const categoryText = line.replace(/\*\*/g, '').trim()
      elements.push(
        <p key={key++} className="preview-quant-category">
          {categoryText}
        </p>
      )
      continue
    }

    // Bullet points
    if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
      const bulletText = line.substring(2).trim()

      if (currentSection === 'takeaways') {
        elements.push(
          <p key={key++} className="preview-bullet preview-takeaway-bullet">
            <span className="bullet-char">{takeawayBullet}</span>
            <span>{bulletText.replace(/\*\*/g, '')}</span>
          </p>
        )
      } else if (currentSection === 'quantitative') {
        // Check for Importance: / Score: / Reason: labels
        if (bulletText.startsWith('**Importance:**') || bulletText.startsWith('Importance:')) {
          const value = stripTrailingPeriod(bulletText.replace('**Importance:**', '').replace('Importance:', ''))
          elements.push(
            <p key={key++} className="preview-bullet preview-quant-bullet">
              <span className="bullet-char">{discussionBullet}</span>
              <span><strong>Importance:</strong> {value}</span>
            </p>
          )
        } else if (bulletText.startsWith('**Score:**') || bulletText.startsWith('Score:')) {
          const value = stripTrailingPeriod(bulletText.replace('**Score:**', '').replace('Score:', ''))
          elements.push(
            <p key={key++} className="preview-bullet preview-quant-bullet">
              <span className="bullet-char">{discussionBullet}</span>
              <span><strong>Score:</strong> {value}</span>
            </p>
          )
        } else if (bulletText.startsWith('**Reason:**') || bulletText.startsWith('Reason:')) {
          const value = stripTrailingPeriod(bulletText.replace('**Reason:**', '').replace('Reason:', ''))
          elements.push(
            <p key={key++} className="preview-bullet preview-quant-bullet">
              <span className="bullet-char">{discussionBullet}</span>
              <span><strong>Reason:</strong> {value}</span>
            </p>
          )
        } else {
          elements.push(
            <p key={key++} className="preview-bullet preview-quant-bullet">
              <span className="bullet-char">{discussionBullet}</span>
              <span>{stripTrailingPeriod(bulletText.replace(/\*\*/g, ''))}</span>
            </p>
          )
        }
      } else {
        // Discussion bullets
        elements.push(
          <p key={key++} className="preview-bullet preview-discussion-bullet">
            <span className="bullet-char">{discussionBullet}</span>
            <span>{stripTrailingPeriod(bulletText.replace(/\*\*/g, ''))}</span>
          </p>
        )
      }
      continue
    }

    // Fallback: regular text
    if (line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '').trim()) {
      elements.push(
        <p key={key++} className="preview-text">
          {line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '').trim()}
        </p>
      )
    }
  }

  return elements
}

export default function FormattedPreview({ content, takeawayBullet = '\u2022', discussionBullet = '\u2022', isStreaming = false }) {
  // While streaming, hold back the incomplete last line. Rendering it live
  // makes it flip styles as markdown markers arrive (plain text becomes a
  // bold-italic question the moment the closing *** lands), which reads as
  // flicker. The tail renders as dimmed plain text with a caret until its
  // newline arrives and it commits to its real style.
  let stableContent = content
  let tail = ''
  if (isStreaming && content) {
    const lastNewline = content.lastIndexOf('\n')
    if (lastNewline === -1) {
      stableContent = ''
      tail = content
    } else {
      stableContent = content.slice(0, lastNewline)
      tail = content.slice(lastNewline + 1)
    }
  }

  const elements = parseMarkdownToElements(stableContent, takeawayBullet, discussionBullet)
  const tailText = tail.replace(/[*#_]/g, '').replace(/^-\s*/, '').trim()

  return (
    <div className="formatted-preview">
      {elements}
      {isStreaming && (
        <p className="preview-streaming-tail">
          {tailText}
          <span className="streaming-caret" />
        </p>
      )}
    </div>
  )
}
