import { useState, useRef, useEffect } from 'react'
import { getDefaultTakeawaysGuidance } from '../services/claude'
import './PromptSettings.css'

const DETAIL_LEVELS = [
  { value: 'concise', label: 'Concise' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'detailed', label: 'Detailed' },
]

const COVERAGE_LEVELS = [
  { value: 'focused', label: 'Focused' },
  { value: 'thorough', label: 'Thorough' },
  { value: 'exhaustive', label: 'Exhaustive' },
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

const EXAMPLE_GUIDANCE = {
  customer: `- [First substantive insight about the relationship, how it started, or overall context]
- [Second insight about what they value or the company's strengths]
- [Third insight about challenges, pain points, or areas for improvement]
- [Fourth insight about growth potential, future outlook, or strategic needs]
- [Optional fifth bullet for additional context, e.g., "Feedback should be considered in context: [relevant caveat]"]`,
  management: `- [Their domain/role and perspective on company trajectory]
- [Key operational insights from their area]
- [Strategic challenges or opportunities they see]
- [Growth initiatives or investment priorities]
- [Optional fifth bullet for additional context or caveats]`,
}

export default function PromptSettings({
  takeawaysGuidance,
  onTakeawaysChange,
  detailLevel,
  onDetailLevelChange,
  coverageLevel,
  onCoverageLevelChange,
  takeawayBullet,
  onTakeawayBulletChange,
  discussionBullet,
  onDiscussionBulletChange,
  formality,
  onFormalityChange,
  discussionQuestionFormat,
  onDiscussionQuestionFormatChange,
  customStyleInstructions,
  onCustomStyleInstructionsChange,
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showExamples, setShowExamples] = useState(false)
  const [showFormalityInfo, setShowFormalityInfo] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [formalityInfoPosition, setFormalityInfoPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef(null)
  const dropdownRef = useRef(null)
  const formalityInfoRef = useRef(null)
  const formalityButtonRef = useRef(null)
  const defaultGuidance = getDefaultTakeawaysGuidance()

  const isManualMode = takeawaysGuidance.trim().length > 0

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setShowExamples(false)
      }
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

  const handleToggleExamples = () => {
    if (!showExamples && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
      })
    }
    setShowExamples(!showExamples)
  }

  const handleClear = () => {
    onTakeawaysChange('')
  }

  const handleUseExample = (type) => {
    onTakeawaysChange(EXAMPLE_GUIDANCE[type])
    setShowExamples(false)
  }

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
    <div className="prompt-settings">
      <button
        type="button"
        className="prompt-settings-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className={`toggle-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
        <span>Key Takeaways</span>
        <span className={`mode-badge ${isManualMode ? 'manual' : 'auto'}`}>
          {isManualMode ? 'Manual Mode' : 'Auto-Detect'}
        </span>
      </button>

      {isExpanded && (
        <div className="prompt-settings-content">
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

          <div className="radio-field">
            <div className="label-with-info">
              <label>Formality</label>
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
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="formality"
                  value="standard"
                  checked={formality === 'standard'}
                  onChange={(e) => onFormalityChange(e.target.value)}
                />
                <span>Standard</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="formality"
                  value="formal"
                  checked={formality === 'formal'}
                  onChange={(e) => onFormalityChange(e.target.value)}
                />
                <span>Formal</span>
              </label>
            </div>
          </div>

          <div className="radio-field">
            <label>Discussion Questions</label>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="discussionQuestionFormat"
                  value="questions"
                  checked={discussionQuestionFormat === 'questions'}
                  onChange={(e) => onDiscussionQuestionFormatChange(e.target.value)}
                />
                <span>As questions</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="discussionQuestionFormat"
                  value="statements"
                  checked={discussionQuestionFormat === 'statements'}
                  onChange={(e) => onDiscussionQuestionFormatChange(e.target.value)}
                />
                <span>As statements</span>
              </label>
            </div>
          </div>

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
              className="prompt-textarea"
              rows={3}
              maxLength={500}
              placeholder='Example: "Emphasize cost and ROI insights" or "Use healthcare industry terminology"'
            />
            <p className="field-helper-text">
              Add optional style instructions for tone, vocabulary, or what to emphasize. Do not include formatting or structure instructions - those are handled automatically. ({customStyleInstructions.length}/500)
            </p>
          </div>

          <div className="prompt-field">
            <div className="prompt-field-header">
              <div className="label-with-info">
                <label htmlFor="takeaways-guidance">Topical Guidance</label>
                <button
                  type="button"
                  className="info-btn"
                  ref={buttonRef}
                  onClick={handleToggleExamples}
                  title="View example templates"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm1 12H7V7h2v5zM8 6a1 1 0 110-2 1 1 0 010 2z"/>
                  </svg>
                </button>
                {showExamples && (
                  <div
                    className="examples-dropdown"
                    ref={dropdownRef}
                    style={{
                      position: 'fixed',
                      top: dropdownPosition.top,
                      left: dropdownPosition.left,
                    }}
                  >
                    <div className="examples-section">
                      <div className="examples-header">
                        <span>Customer Calls</span>
                        <button
                          type="button"
                          className="use-example-btn"
                          onClick={() => handleUseExample('customer')}
                        >
                          Use this
                        </button>
                      </div>
                      <ul>
                        <li>Relationship origin and overall context</li>
                        <li>What they value / company's strengths</li>
                        <li>Challenges, pain points, or areas for improvement</li>
                        <li>Growth potential, future outlook, or strategic needs</li>
                      </ul>
                    </div>
                    <div className="examples-section">
                      <div className="examples-header">
                        <span>Management Calls</span>
                        <button
                          type="button"
                          className="use-example-btn"
                          onClick={() => handleUseExample('management')}
                        >
                          Use this
                        </button>
                      </div>
                      <ul>
                        <li>Their domain/role and perspective on company trajectory</li>
                        <li>Key operational insights from their area</li>
                        <li>Strategic challenges or opportunities they see</li>
                        <li>Growth initiatives or investment priorities</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
              <div className="prompt-actions">
                {isManualMode && (
                  <button
                    type="button"
                    className="clear-btn"
                    onClick={handleClear}
                  >
                    Clear (Auto-Detect)
                  </button>
                )}
              </div>
            </div>
            <p className="prompt-description">
              Control <strong>what themes</strong> the takeaways should cover. Style and quality rules
              are always applied automatically.
            </p>
            {isManualMode ? (
              <textarea
                id="takeaways-guidance"
                value={takeawaysGuidance}
                onChange={(e) => onTakeawaysChange(e.target.value)}
                className="prompt-textarea"
                rows={6}
              />
            ) : (
              <div className="auto-mode-state">
                <p>No topical guidance provided. Claude will use best judgment to identify the most important themes.</p>
                <button
                  type="button"
                  className="use-default-btn"
                  onClick={() => onTakeawaysChange(defaultGuidance)}
                >
                  + Add Topical Guidance
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
