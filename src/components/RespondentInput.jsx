import './RespondentInput.css'

function RespondentInput({
  value,
  onChange,
  onClear,
  isManuallyEdited,
  interviewDate,
  onInterviewDateChange,
  extraAttendees = [],
  onExtraAttendeesChange,
}) {
  const handleFieldChange = (field, fieldValue) => {
    onChange({
      ...value,
      [field]: fieldValue,
    })
  }

  const hasContent = value.name || value.role || value.company

  const handleExtraChange = (index, name) => {
    const next = [...extraAttendees]
    next[index] = name
    onExtraAttendeesChange(next)
  }

  const handleExtraRemove = (index) => {
    onExtraAttendeesChange(extraAttendees.filter((_, i) => i !== index))
  }

  return (
    <div className="respondent-input">
      <div className="respondent-header">
        <label className="respondent-label">Speaker + Attendees</label>
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

      {extraAttendees.map((name, index) => (
        <div className="extra-attendee-row" key={index}>
          <input
            type="text"
            placeholder="Additional company attendee"
            value={name}
            onChange={(e) => handleExtraChange(index, e.target.value)}
            className="respondent-field"
          />
          <button
            type="button"
            className="remove-attendee-btn"
            onClick={() => handleExtraRemove(index)}
            title="Remove attendee"
            aria-label="Remove attendee"
          >
            ×
          </button>
        </div>
      ))}

      <div className="respondent-meta-row">
        <button
          type="button"
          className="add-attendee-btn"
          onClick={() => onExtraAttendeesChange([...extraAttendees, ''])}
          title="Add another company attendee to the Attendees line"
        >
          + Attendee
        </button>
        <div className="interview-date-field">
          <label htmlFor="interview-date">Date</label>
          <input
            id="interview-date"
            type="date"
            value={interviewDate}
            onChange={(e) => onInterviewDateChange(e.target.value)}
            className="respondent-field interview-date-input"
          />
        </div>
      </div>

      <p className="respondent-hint">
        {isManuallyEdited
          ? 'Using your input for the title line and attendees.'
          : 'Leave empty to auto-detect from notes, or enter manually to override. Name and any added attendees fill the Attendees line.'}
      </p>
    </div>
  )
}

export default RespondentInput
