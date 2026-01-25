import './RespondentInput.css'

function RespondentInput({ value, onChange, onClear, isManuallyEdited }) {
  const handleFieldChange = (field, fieldValue) => {
    onChange({
      ...value,
      [field]: fieldValue,
    })
  }

  const hasContent = value.name || value.role || value.company

  return (
    <div className="respondent-input">
      <div className="respondent-header">
        <label className="respondent-label">Respondent Info</label>
        <div className="respondent-status">
          {isManuallyEdited && <span className="status-badge manual">Manual</span>}
          {!isManuallyEdited && hasContent && <span className="status-badge auto">Auto-filled</span>}
          {hasContent && (
            <button className="clear-respondent-btn" onClick={onClear}>
              Clear
            </button>
          )}
        </div>
      </div>
      <div className="respondent-fields">
        <input
          type="text"
          placeholder="Name"
          value={value.name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          className="respondent-field"
        />
        <input
          type="text"
          placeholder="Role / Title"
          value={value.role}
          onChange={(e) => handleFieldChange('role', e.target.value)}
          className="respondent-field"
        />
        <input
          type="text"
          placeholder="Company"
          value={value.company}
          onChange={(e) => handleFieldChange('company', e.target.value)}
          className="respondent-field"
        />
      </div>
      <p className="respondent-hint">
        {isManuallyEdited
          ? 'Using your input for the title line.'
          : 'Leave empty to auto-detect from notes, or enter manually to override.'}
      </p>
    </div>
  )
}

export default RespondentInput
