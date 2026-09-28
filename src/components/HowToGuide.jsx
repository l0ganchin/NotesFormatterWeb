import { useEffect } from 'react'
import './HowToGuide.css'

export default function HowToGuide({ isOpen, onClose }) {
  // Close on Escape
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
    <div className="howto-overlay" onClick={onClose}>
      <div
        className="howto-modal"
        role="dialog"
        aria-modal="true"
        aria-label="How to use this app"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="howto-header">
          <h2>How to Use</h2>
          <button className="howto-close" onClick={onClose} aria-label="Close guide">
            ×
          </button>
        </div>

        <div className="howto-content">
          <p className="howto-intro">
            Notes Formatter turns raw interview transcripts and meeting notes into polished,
            client-ready documentation in the WG notes template: a branded running header, a
            titled write-up with Date and Attendees, executive Key Takeaways, a comprehensive
            Discussion section, and Quantitative Scores where the interview includes them.
            Format an interview, review the live preview, then export it as a Word document.
          </p>

          <section>
            <h3>Quick Start</h3>
            <ol>
              <li>Pick the <strong>call type</strong> at the top (Management, Customer, or Expert) — it fills the parameters and sets the Word header.</li>
              <li>Paste or upload the interview <strong>transcript</strong> (meeting notes are optional).</li>
              <li>Click <strong>Format Notes</strong> and watch the output stream in live.</li>
              <li><strong>Export</strong> to Word.</li>
            </ol>
          </section>

          <section>
            <h3>Call Types &amp; Presets</h3>
            <ul>
              <li>The three pills at the top — <strong>Management, Customer, Expert</strong> — each hold their own saved parameters within a project, and the active pill becomes the "Type of Call" in the exported header.</li>
              <li>In project mode, tweak any parameters and hit <strong>Save</strong> to persist them to the active pill. Unsaved changes show a dot on the pill and only apply to the current note.</li>
              <li>Switching pills keeps your unsaved edits — each pill remembers its own in-progress changes until you leave the project.</li>
              <li><strong>Save As…</strong> copies the current parameters into any preset slot of a new or existing project — handy for turning a one-off setup into a project, or reusing a template across projects.</li>
            </ul>
          </section>

          <section>
            <h3>Inputs</h3>
            <ul>
              <li><strong>Project Metadata</strong> — Project Name and Company, shared by all three presets. Project Name (blue) is the project's actual name: rename it and hit Save to rename the project. It fills the Word header; both fill the exported filename "Winterberry Group -- [Company] [Project] [Type] Call Notes -- DD Month YYYY".</li>
              <li><strong>Call Info</strong> — respondent name/role/company are auto-detected after the first run; type them in to override. The <strong>Date</strong> and the respondent name (plus any <strong>+ Attendee</strong> additions) fill the Date and Attendees lines under the title.</li>
              <li><strong>WG Attendees</strong> — tap the team initials on the call; they appear on the WG Attendees line in roster order.</li>
              <li><strong>Transcript</strong> — the source of truth. Every substantive topic in it appears in the output.</li>
              <li><strong>Meeting Notes</strong> (optional) — strictly additive. Topics in your notes get extra prominence, and notes-only points are worked in, but notes never reduce what the transcript contributes.</li>
              <li><strong>Custom Style Instructions</strong> — refine tone, emphasis, and detail. They can't change the output structure.</li>
              <li><strong>Project Context</strong> — tell the formatter who is who (client vs. team members) and what to focus on.</li>
            </ul>
          </section>

          <section>
            <h3>Settings Panels</h3>
            <ul>
              <li><strong>Key Takeaways</strong> — leave empty to auto-detect themes, or add topical guidance (the ⓘ icon has templates for customer and management calls). Style and quality rules are always applied.</li>
              <li><strong>Quantitative Scores</strong> — categories and scales are auto-detected from the interview; add them manually to lock the exact order and scales. Check <strong>Include Importance ratings</strong> when the interviewer asks "how important is X… and how good are they at it?" — each category then gets an Importance line before its Score (N/A when not asked).</li>
              <li><strong>Format &amp; Style</strong> — coverage level, takeaway length, bullet glyphs, question-vs-statement headers, and first-vs-third person voice.</li>
            </ul>
          </section>

          <section>
            <h3>Output</h3>
            <ul>
              <li>Output streams in live — <strong>Stop</strong> keeps whatever has arrived.</li>
              <li><strong>Preview</strong> approximates the Word formatting; <strong>Raw</strong> shows the underlying markdown (that's also what Copy copies).</li>
              <li>After the first run, respondent info and quant categories auto-fill for subsequent interviews.</li>
            </ul>
          </section>

          <section>
            <h3>Exporting</h3>
            <ul>
              <li><strong>New Document</strong> — a standalone .docx in the WG template: running header with the logo, black Heading 1 title, Date/Attendees block, and native Word bullets.</li>
              <li><strong>Append to Existing</strong> — adds the note to a .docx you choose. It starts on the page after the existing content (no blank page), and the existing document's styles, lists, header, and table of contents are untouched. Tip: if the target has a ToC, update it in Word with Ctrl+A, then F9.</li>
            </ul>
          </section>

          <section>
            <h3>Projects</h3>
            <ul>
              <li>Sign in and open <strong>My Projects</strong> to create one. Each project holds a Management, Customer, and Expert preset plus the project name — hit <strong>Save Preset</strong> to persist changes.</li>
              <li><strong>Share</strong> a project by email — teammates need to have signed in at least once.</li>
              <li>Click the logo in the header to reset inputs for the next interview (preset settings stay).</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
