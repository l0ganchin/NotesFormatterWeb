import { useState } from 'react'
import './QuantSettings.css'

export default function QuantSettings({ categories, onCategoriesChange }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const isManualMode = categories.length > 0

  const handleAddCategory = () => {
    onCategoriesChange([...categories, { name: '', scale: 10 }])
  }

  const handleRemoveCategory = (index) => {
    const updated = categories.filter((_, i) => i !== index)
    onCategoriesChange(updated)
  }

  const handleNameChange = (index, value) => {
    const updated = categories.map((cat, i) =>
      i === index ? { ...cat, name: value } : cat
    )
    onCategoriesChange(updated)
  }

  const handleScaleChange = (index, delta) => {
    const updated = categories.map((cat, i) => {
      if (i === index) {
        const newScale = Math.max(1, Math.min(100, cat.scale + delta))
        return { ...cat, scale: newScale }
      }
      return cat
    })
    onCategoriesChange(updated)
  }

  const handleScaleInput = (index, value) => {
    const parsed = parseInt(value) || 10
    const clamped = Math.max(1, Math.min(100, parsed))
    const updated = categories.map((cat, i) =>
      i === index ? { ...cat, scale: clamped } : cat
    )
    onCategoriesChange(updated)
  }

  const handleClearAll = () => {
    onCategoriesChange([])
  }

  return (
    <div className="quant-settings">
      <button
        type="button"
        className="quant-settings-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className={`toggle-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
        <span>Quantitative Scores</span>
        <span className={`mode-badge ${isManualMode ? 'manual' : 'auto'}`}>
          {isManualMode ? 'Manual Mode' : 'Auto-Detect'}
        </span>
      </button>

      {isExpanded && (
        <div className="quant-settings-content">
          <div className="quant-categories">
            {categories.length === 0 ? (
              <div className="empty-state">
                <p>No categories defined. Claude will auto-detect from transcript.</p>
              </div>
            ) : (
              <div className="category-list">
                <div className="category-header">
                  <span className="header-name">Category Name</span>
                  <span className="header-scale">Scale</span>
                  <span className="header-actions"></span>
                </div>
                {categories.map((cat, index) => (
                  <div key={index} className="category-row">
                    <input
                      type="text"
                      value={cat.name}
                      onChange={(e) => handleNameChange(index, e.target.value)}
                      placeholder="e.g., Overall Satisfaction"
                      className="category-name-input"
                    />
                    <div className="scale-input-group">
                      <button
                        type="button"
                        className="scale-btn"
                        onClick={() => handleScaleChange(index, -1)}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={cat.scale}
                        onChange={(e) => handleScaleInput(index, e.target.value)}
                        className="scale-input"
                        min="1"
                        max="100"
                      />
                      <button
                        type="button"
                        className="scale-btn"
                        onClick={() => handleScaleChange(index, 1)}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(index)}
                      className="remove-category-btn"
                      title="Remove category"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="quant-actions">
              <button
                type="button"
                onClick={handleAddCategory}
                className="add-category-btn"
              >
                + Add Category
              </button>
              {categories.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="clear-all-btn"
                >
                  Clear All (Auto-Detect)
                </button>
              )}
            </div>
          </div>

          <div className="quant-help">
            <p>• By default, categories are auto-detected from the transcript.</p>
            <p>• Adding a category switches to manual mode and overrides auto-detection.</p>
            <p>• Categories not mentioned in the transcript will be marked as "Not discussed."</p>
          </div>
        </div>
      )}
    </div>
  )
}
