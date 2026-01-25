import './FormattedPreview.css'

function parseMarkdownToElements(markdown) {
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

    // Discussion question (bold + italic: ***)
    if (currentSection === 'discussion' && (line.startsWith('***') || line.startsWith('**_'))) {
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
            <span className="bullet-char">➤</span>
            <span>{bulletText.replace(/\*\*/g, '')}</span>
          </p>
        )
      } else if (currentSection === 'quantitative') {
        // Check for Score: or Reason: labels
        if (bulletText.startsWith('**Score:**') || bulletText.startsWith('Score:')) {
          const value = bulletText.replace('**Score:**', '').replace('Score:', '').trim()
          elements.push(
            <p key={key++} className="preview-bullet preview-quant-bullet">
              <span className="bullet-char">•</span>
              <span><strong>Score:</strong> {value}</span>
            </p>
          )
        } else if (bulletText.startsWith('**Reason:**') || bulletText.startsWith('Reason:')) {
          const value = bulletText.replace('**Reason:**', '').replace('Reason:', '').trim()
          elements.push(
            <p key={key++} className="preview-bullet preview-quant-bullet">
              <span className="bullet-char">•</span>
              <span><strong>Reason:</strong> {value}</span>
            </p>
          )
        } else {
          elements.push(
            <p key={key++} className="preview-bullet preview-quant-bullet">
              <span className="bullet-char">•</span>
              <span>{bulletText.replace(/\*\*/g, '')}</span>
            </p>
          )
        }
      } else {
        // Discussion bullets
        elements.push(
          <p key={key++} className="preview-bullet preview-discussion-bullet">
            <span className="bullet-char">•</span>
            <span>{bulletText.replace(/\*\*/g, '')}</span>
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

export default function FormattedPreview({ content }) {
  const elements = parseMarkdownToElements(content)

  return (
    <div className="formatted-preview">
      {elements}
    </div>
  )
}
