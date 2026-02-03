import { useState, useRef, useEffect } from 'react'
import './FormatStyleSettings.css'

const COVERAGE_LEVELS = [
  { value: 'focused', label: 'Focused' },
  { value: 'thorough', label: 'Thorough' },
  { value: 'exhaustive', label: 'Exhaustive' },
]

const DETAIL_LEVELS = [
  { value: 'concise', label: 'Concise' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'detailed', label: 'Detailed' },
]

const BULLET_OPTIONS = [
  { label: '→ Right arrow', value: '\u27A4', display: '→' },
  { label: '• Bullet', value: '\u2022', display: '•' },
  { label: '‣ Triangle bullet', value: '\u2023', display: '‣' },
  { label: '▸ Black triangle', value: '\u25B8', display: '▸' },
  { label: '▹ White triangle', value: '\u25B9', display: '▹' },
  { label: '▪ Black square', value: '\u25AA', display: '▪' },
  { label: '◦ White bullet', value: '\u25E6', display: '◦' },
  { label: '- Hyphen', value: '-', display: '-' },
]

export default function FormatStyleSettings({
  coverageLevel,
  onCoverageLevelChange,
  detailLevel,
  onDetailLevelChange,
  takeawayBullet,
  onTakeawayBulletChange,
  discussionBullet,
  onDiscussionBulletChange,
  discussionQuestionFormat,
  onDiscussionQuestionFormatChange,
  formality,
  onFormalityChange,
  customStyleInstructions,
  onCustomStyleInstructionsChange,
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showFormalityInfo, setShowFormalityInfo] = useState(false)
  const [formalityInfoPosition, setFormalityInfoPosition] = useState({ top: 0, left: 0 })
  const formalityInfoRef = useRef(null)
  const formalityButtonRef = useRef(null)

  // Close formality info dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        formalityInfoRef.current &&
        !formalityInfoRef.current.contains(event.target) &&
        formalityButtonRef.current &&
        !formalityButtonRef.current.contains(event.target)
      ) {
        setShowFormalityInfo(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggleFormalityInfo = () => {
    if (!showFormalityInfo && formalityButtonRef.current) {
      const rect = formalityButtonRef.current.getBoundingClientRect()
      setFormalityInfoPosition({
        top: rect.bottom + 8,
        left: rect.left,
      })
    }
    setShowFormalityInfo(!showFormalityInfo)
  }

  return (
    <div className="format-style-settings">
      <button
        type="button"
        className="format-style-settings-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className={`toggle-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
        <span>Format & Style</span>
      </button>

      {isExpanded && (
        <div className="format-style-settings-content">
          {/* Coverage Level - standalone */}
          <div className="detail-level-field">
            <label>Coverage Level</label>
            <div className="detail-level-selector">
              {COVERAGE_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  className={`detail-level-btn ${coverageLevel === level.value ? 'active' : ''}`}
                  onClick={() => onCoverageLevelChange(level.value)}
                >
                  {level.label}
                </button>
              ))}
            </div>
            <p className="detail-level-description">
              {coverageLevel === 'focused' && 'Core insights and critical information only. Concise and to the point.'}
              {coverageLevel === 'thorough' && 'All important content with supporting context and key details.'}
              {coverageLevel === 'exhaustive' && 'Complete capture of all discussion points with maximum detail.'}
            </p>
          </div>

          {/* Key Takeaways Section */}
          <h4 className="format-style-section-header">Key Takeaways Style</h4>

          <div className="detail-level-field">
            <label>Detail Level</label>
            <div className="detail-level-selector">
              {DETAIL_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  className={`detail-level-btn ${detailLevel === level.value ? 'active' : ''}`}
                  onClick={() => onDetailLevelChange(level.value)}
                >
                  {level.label}
                </button>
              ))}
            </div>
            <p className="detail-level-description">
              {detailLevel === 'concise' && '1-2 sentences per bullet. Core insight + one supporting point.'}
              {detailLevel === 'balanced' && '2-3 sentences per bullet. Topic statement + supporting context.'}
              {detailLevel === 'detailed' && '3-4 sentences per bullet. Fuller context, examples, and implications.'}
            </p>
          </div>

          <div className="bullet-field">
            <label htmlFor="takeaway-bullet">Key Takeaways Bullets</label>
            <select
              id="takeaway-bullet"
              value={takeawayBullet}
              onChange={(e) => onTakeawayBulletChange(e.target.value)}
              className="bullet-select"
            >
              {BULLET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.display} {option.label.replace(option.display, '').trim()}
                </option>
              ))}
            </select>
          </div>

          {/* Discussion Section */}
          <h4 className="format-style-section-header">Discussion Format & Style</h4>

          <div className="detail-level-field">
            <label>Discussion Questions</label>
            <div className="detail-level-selector">
              <button
                type="button"
                className={`detail-level-btn ${discussionQuestionFormat === 'questions' ? 'active' : ''}`}
                onClick={() => onDiscussionQuestionFormatChange('questions')}
              >
                As questions
              </button>
              <button
                type="button"
                className={`detail-level-btn ${discussionQuestionFormat === 'statements' ? 'active' : ''}`}
                onClick={() => onDiscussionQuestionFormatChange('statements')}
              >
                As statements
              </button>
            </div>
          </div>

          <div className="bullet-field">
            <label htmlFor="discussion-bullet">Discussion Bullets</label>
            <select
              id="discussion-bullet"
              value={discussionBullet}
              onChange={(e) => onDiscussionBulletChange(e.target.value)}
              className="bullet-select"
            >
              {BULLET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.display} {option.label.replace(option.display, '').trim()}
                </option>
              ))}
            </select>
          </div>

          {/* Formality Section */}
          <div className="format-style-section-header-container">
            <h4 className="format-style-section-header">Formality</h4>
            <button
              type="button"
              className="info-btn"
              ref={formalityButtonRef}
              onClick={handleToggleFormalityInfo}
              title="View formality explanation"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm1 12H7V7h2v5zM8 6a1 1 0 110-2 1 1 0 010 2z"/>
              </svg>
            </button>
            {showFormalityInfo && (
              <div
                className="examples-dropdown formality-info"
                ref={formalityInfoRef}
                style={{
                  position: 'fixed',
                  top: formalityInfoPosition.top,
                  left: formalityInfoPosition.left,
                }}
              >
                <div className="formality-info-content">
                  <p><strong>Standard:</strong> Discussion points written in first person ("I", "we") with a professional but conversational tone. Key takeaways in third person.</p>
                  <p><strong>Formal:</strong> Discussion points written in third person with polished, executive brief language suitable for C-suite audiences.</p>
                </div>
              </div>
            )}
          </div>

          <div className="detail-level-field">
            <div className="detail-level-selector">
              <button
                type="button"
                className={`detail-level-btn ${formality === 'standard' ? 'active' : ''}`}
                onClick={() => onFormalityChange('standard')}
              >
                Standard
              </button>
              <button
                type="button"
                className={`detail-level-btn ${formality === 'formal' ? 'active' : ''}`}
                onClick={() => onFormalityChange('formal')}
              >
                Formal
              </button>
            </div>
          </div>

          {/* Custom Style Instructions - standalone */}
          <div className="custom-instructions-field">
            <label htmlFor="custom-style">Custom Style Instructions (Optional)</label>
            <textarea
              id="custom-style"
              value={customStyleInstructions}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  onCustomStyleInstructionsChange(e.target.value)
                }
              }}
              className="format-style-textarea"
              rows={3}
              maxLength={500}
              placeholder='Example: "Emphasize cost and ROI insights" or "Use healthcare industry terminology"'
            />
            <p className="field-helper-text">
              Add optional style instructions for tone, vocabulary, or what to emphasize. Do not include formatting or structure instructions - those are handled automatically. ({customStyleInstructions.length}/500)
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
