import { useRef } from 'react'
import mammoth from 'mammoth'
import './FileInput.css'

async function extractTextFromFile(file) {
  const fileName = file.name.toLowerCase()

  // Handle .docx files
  if (fileName.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  }

  // Handle .doc files (older format) - not supported, show message
  if (fileName.endsWith('.doc')) {
    throw new Error('Old .doc format not supported. Please save as .docx or .txt')
  }

  // Handle plain text files (.txt, .md, etc.)
  return await file.text()
}

export default function FileInput({ label, value, onChange, placeholder }) {
  const fileInputRef = useRef(null)

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      const text = await extractTextFromFile(file)
      onChange(text)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    e.currentTarget.classList.remove('drag-over')

    const file = e.dataTransfer.files[0]
    if (!file) return

    try {
      const text = await extractTextFromFile(file)
      onChange(text)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.currentTarget.classList.add('drag-over')
  }

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over')
  }

  return (
    <div className="file-input">
      <label className="file-input-label">{label}</label>
      <div
        className="file-input-area"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="file-input-textarea"
        />
        <div className="file-input-actions">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".txt,.md,.docx"
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="upload-btn"
          >
            Upload File
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="clear-btn"
            >
              Clear
            </button>
          )}
        </div>
        <p className="file-input-hint">Or drag and drop a file here (.txt, .md, .docx)</p>
      </div>
    </div>
  )
}
