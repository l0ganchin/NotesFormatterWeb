import { useState, useEffect } from 'react'
import FormattedPreview from './FormattedPreview'
import './OutputDisplay.css'

const LOADING_MESSAGES = [
  'Reading through the transcript...',
  'Identifying key themes and insights...',
  'Synthesizing discussion points...',
  'Crafting executive-level takeaways...',
  'Formatting quantitative scores...',
  'Polishing the final output...',
  'Almost there...',
]

export default function OutputDisplay({ content, isLoading, onExportWord, onExportPdf }) {
  const [viewMode, setViewMode] = useState('preview') // 'preview' or 'raw'
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [messageIndex, setMessageIndex] = useState(0)

  // Timer effect
  useEffect(() => {
    if (!isLoading) {
      setElapsedSeconds(0)
      setMessageIndex(0)
      return
    }

    const timerInterval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(timerInterval)
  }, [isLoading])

  // Rotate messages every 4 seconds
  useEffect(() => {
    if (!isLoading) return

    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
    }, 4000)

    return () => clearInterval(messageInterval)
  }, [isLoading])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}m ${secs}s`
    }
    return `${secs}s`
  }

  if (isLoading && !content) {
    // Show spinner only when no content has arrived yet
    return (
      <div className="output-display">
        <div className="output-header">
          <h2>Formatted Output</h2>
        </div>
        <div className="output-content loading">
          <div className="spinner"></div>
          <div className="loading-info">
            <p className="loading-status">{LOADING_MESSAGES[messageIndex]}</p>
            <p className="loading-timer">{formatTime(elapsedSeconds)} elapsed</p>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading && content) {
    // Show streaming content with loading indicator
    return (
      <div className="output-display">
        <div className="output-header">
          <h2>Formatted Output</h2>
          <div className="streaming-indicator">
            <div className="spinner-small"></div>
            <span>{formatTime(elapsedSeconds)}</span>
          </div>
        </div>
        <div className="output-content preview-mode streaming">
          <FormattedPreview content={content} />
        </div>
      </div>
    )
  }

  if (!content) {
    return (
      <div className="output-display">
        <div className="output-header">
          <h2>Formatted Output</h2>
        </div>
        <div className="output-content empty">
          <p>Formatted notes will appear here</p>
        </div>
      </div>
    )
  }

  return (
    <div className="output-display">
      <div className="output-header">
        <h2>Formatted Output</h2>
        <div className="output-actions">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'preview' ? 'active' : ''}`}
              onClick={() => setViewMode('preview')}
            >
              Preview
            </button>
            <button
              className={`toggle-btn ${viewMode === 'raw' ? 'active' : ''}`}
              onClick={() => setViewMode('raw')}
            >
              Raw
            </button>
          </div>
          <button
            className="copy-btn"
            onClick={() => navigator.clipboard.writeText(content)}
          >
            Copy
          </button>
          <button
            className="export-btn"
            onClick={onExportWord}
          >
            Word
          </button>
          <button
            className="export-btn"
            onClick={onExportPdf}
          >
            PDF
          </button>
        </div>
      </div>
      <div className={`output-content ${viewMode === 'preview' ? 'preview-mode' : ''}`}>
        {viewMode === 'preview' ? (
          <FormattedPreview content={content} />
        ) : (
          <pre>{content}</pre>
        )}
      </div>
    </div>
  )
}
