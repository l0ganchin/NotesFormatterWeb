import { useState } from 'react'
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

// Bullet options matching Word's built-in Bullet Library
const BULLET_OPTIONS = [
  { label: '● Filled circle', value: '\u25CF', display: '●' },
  { label: '○ Empty circle', value: '\u25CB', display: '○' },
  { label: '■ Filled square', value: '\u25A0', display: '■' },
  { label: '➢ Arrow', value: '\u27A2', display: '➢' },
  { label: '– Dash', value: '\u2013', display: '–' },
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
}) {
  const [isExpanded, setIsExpanded] = useState(false)

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
          <div className="detail-level-field">
            <label>Formality</label>
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
            <p className="detail-level-description">
              {formality === 'standard' && 'Discussion points in first person ("I", "we") with professional but conversational tone.'}
              {formality === 'formal' && 'Discussion points in third person with polished, executive brief language.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
