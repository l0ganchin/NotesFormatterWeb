import { useState, useRef, useEffect } from 'react'
import { getDefaultTakeawaysGuidance } from '../services/claude'
import './PromptSettings.css'

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
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showExamples, setShowExamples] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef(null)
  const dropdownRef = useRef(null)
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
