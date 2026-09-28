import { useState, useEffect, useRef } from 'react'
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

export default function OutputDisplay({
  content,
  isLoading,
  onExportWord,
  takeawayBullet = '•',
  discussionBullet = '•',
  noteMeta = null,
}) {
  const [viewMode, setViewMode] = useState('preview') // 'preview' or 'raw'
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [messageIndex, setMessageIndex] = useState(0)
  const [copied, setCopied] = useState(false)

  // Auto-scroll: follow the stream only while the user is at (or near) the
  // bottom of the output; scrolling up to read releases the pin
  const contentRef = useRef(null)
  const pinnedToBottomRef = useRef(true)

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

  // Reset transient states when content changes
  useEffect(() => {
    setCopied(false)
  }, [content])

  // Re-pin to bottom at the start of each new run
  useEffect(() => {
    if (isLoading && !content) {
      pinnedToBottomRef.current = true
    }
  }, [isLoading, content])

  // Follow the stream while pinned
  useEffect(() => {
    if (!isLoading) return
    const el = contentRef.current
    if (el && pinnedToBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [content, isLoading])

  const handleScroll = () => {
    const el = contentRef.current
    if (!el) return
    pinnedToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const handleCopy = () => {
    if (!content) return
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}m ${secs}s`
    }
    return `${secs}s`
  }

  const showEmpty = !isLoading && !content
  const showSkeleton = isLoading && !content

  // One stable layout across empty / waiting / streaming / done states, so
  // the chrome never jumps when streaming starts or finishes
  return (
    <div className="output-display">
      <div className="output-header">
        <h2>Formatted Output</h2>
        <div className="output-actions">
          {isLoading && (
            <div className="streaming-indicator">
              <div className="spinner-small"></div>
              <span className="streaming-timer">{formatTime(elapsedSeconds)}</span>
            </div>
          )}
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'preview' ? 'active' : ''}`}
              onClick={() => setViewMode('preview')}
              disabled={!content}
            >
              Preview
            </button>
            <button
              className={`toggle-btn ${viewMode === 'raw' ? 'active' : ''}`}
              onClick={() => setViewMode('raw')}
              disabled={!content}
            >
              Raw
            </button>
          </div>
          <button
            className={`copy-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            disabled={!content}
          >
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
          <button
            className="export-btn"
            onClick={onExportWord}
            disabled={!content || isLoading}
          >
            Export .docx
          </button>
        </div>
      </div>

      {isLoading && <div className="streaming-progress" />}

      {viewMode === 'preview' && content && (
        <p className="preview-disclaimer">This is a preview and may contain errors. Export for final formatting.</p>
      )}

      <div
        className={`output-content ${viewMode === 'preview' && content ? 'preview-mode' : ''} ${showEmpty ? 'empty' : ''}`}
        ref={contentRef}
        onScroll={handleScroll}
      >
        {showEmpty && <p>Formatted notes will appear here</p>}
        {showSkeleton && (
          <div className="output-skeleton">
            <div className="skeleton-line skeleton-title"></div>
            <div className="skeleton-line w-90"></div>
            <div className="skeleton-line w-75"></div>
            <div className="skeleton-line w-85"></div>
            <div className="skeleton-line w-60"></div>
            <p className="loading-status" key={messageIndex}>{LOADING_MESSAGES[messageIndex]}</p>
          </div>
        )}
        {content && (
          viewMode === 'preview' ? (
            <FormattedPreview
              content={content}
              takeawayBullet={takeawayBullet}
              discussionBullet={discussionBullet}
              isStreaming={isLoading}
              noteMeta={noteMeta}
            />
          ) : (
            <pre>{content}</pre>
          )
        )}
      </div>
    </div>
  )
}
