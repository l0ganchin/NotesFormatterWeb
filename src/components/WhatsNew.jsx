import { useEffect } from 'react'
import './WhatsNew.css'

// Bump this when shipping a release worth announcing — the popup shows once
// per browser per version (tracked in localStorage by App.jsx)
export const WHATS_NEW_VERSION = '2026-07-22'

export default function WhatsNew({ isOpen, onClose, onOpenGuide }) {
  // Close on Escape (also marks as seen via onClose)
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="whatsnew-overlay" onClick={onClose}>
      <div
        className="whatsnew-modal"
        role="dialog"
        aria-modal="true"
        aria-label="What's new"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="whatsnew-header">
          <h2><span className="whatsnew-spark" aria-hidden="true">✨</span> What&apos;s New</h2>
          <span className="whatsnew-date">July 2026</span>
        </div>

        <div className="whatsnew-content">
          <ul>
            <li>
              <strong>Cleaner writing.</strong> Filler words and AI-style phrasing (em-dash
              asides, stock intensifiers) are stripped; takeaways are tighter and follow a
              new four-theme template; speaker references vary naturally.
            </li>
            <li>
              <strong>Importance ratings.</strong> Quant sections support an Importance line
              before each Score (N/A when not asked) — toggle it in Quantitative Scores;
              it saves with the project.
            </li>
            <li>
              <strong>Append fixed.</strong> Appending to an existing document or master doc
              no longer breaks bullets into numbered lists, starts on the next page with no
              blank page, and leaves the target document untouched.
            </li>
            <li>
              <strong>Word export fidelity.</strong> All bullets export as real Word list
              bullets with consistent spacing; takeaways keep their periods, discussion and
              quant bullets drop trailing ones.
            </li>
            <li>
              <strong>Smoother app.</strong> Streaming output no longer jumps, a warning
              appears if output hits the length limit, and the UI got a visual refresh.
            </li>
          </ul>
        </div>

        <div className="whatsnew-footer">
          <button type="button" className="whatsnew-guide-btn" onClick={onOpenGuide}>
            Open the How to Use guide
          </button>
          <button type="button" className="whatsnew-dismiss-btn" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
