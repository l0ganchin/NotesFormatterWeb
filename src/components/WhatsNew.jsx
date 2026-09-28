import { useEffect } from 'react'
import './WhatsNew.css'

// Bump this when shipping a release worth announcing — the popup shows once
// per browser per version (tracked in localStorage by App.jsx)
export const WHATS_NEW_VERSION = '2026-09-28'

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
          <span className="whatsnew-date">September 2026</span>
        </div>

        <div className="whatsnew-content">
          <ul>
            <li>
              <strong>New WG notes template.</strong> Exports match the updated template:
              a running header with the WG logo and "[Project name]: [Type of Call] Notes",
              a black Heading 1 title, and Open Sans 12pt body with template spacing.
            </li>
            <li>
              <strong>Call-type presets.</strong> Each project holds Management, Customer,
              and Expert presets — switch with the pills at the top; the active pill sets
              the Type of Call. Changes apply to the current note and persist only when you
              hit Save; Save As… copies them into any preset of a new or existing project.
            </li>
            <li>
              <strong>Smarter file names.</strong> Documents save as "Winterberry Group --
              [Company] [Project] [Type] Call Notes -- [Date]", driven by the new Project
              Metadata section — where renaming the project name (and hitting Save) renames
              the project itself. Projects can also be renamed from My Projects.
            </li>
            <li>
              <strong>Date &amp; attendees.</strong> Each note gets a Date, [Company] Attendees,
              and WG Attendees block under the title — set the date, add extra company
              attendees with +, and tap WG initials.
            </li>
            <li>
              <strong>Decluttered.</strong> Meeting Notes is now a collapsible dropdown, and
              the project files browser and cloud master docs are gone — export a new
              document or append to a local .docx instead.
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
