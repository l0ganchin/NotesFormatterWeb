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
            client-ready documentation: a titled write-up with executive Key Takeaways, a
            comprehensive Discussion section, and Quantitative Scores where the interview
            includes them. Format an interview, review the live preview, then export it as a
            Word document or collect a whole engagement's interviews into a shared master doc.
          </p>

          <section>
            <h3>Quick Start</h3>
            <ol>
              <li>Paste or upload the interview <strong>transcript</strong> (meeting notes are optional).</li>
              <li>Click <strong>Format Notes</strong> and watch the output stream in live.</li>
              <li><strong>Export</strong> to Word, or save it to a project.</li>
            </ol>
          </section>

          <section>
            <h3>Inputs</h3>
            <ul>
              <li><strong>Transcript</strong> — the source of truth. Every substantive topic in it appears in the output.</li>
              <li><strong>Meeting Notes</strong> (optional) — strictly additive. Topics in your notes get extra prominence, and notes-only points are worked in, but notes never reduce what the transcript contributes.</li>
              <li><strong>Custom Style Instructions</strong> — refine tone, emphasis, and detail. They can't change the output structure.</li>
              <li><strong>Project Context</strong> — tell the formatter who is who (client vs. team members) and what to focus on.</li>
              <li><strong>Respondent</strong> — auto-detected after the first run; type it in yourself to override the title line and filenames.</li>
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
              <li><strong>New Document</strong> — a standalone .docx with native Word bullets.</li>
              <li><strong>Append to Existing</strong> — adds the note to a .docx you choose. It starts on the page after the existing content (no blank page), and the existing document's styles, lists, and table of contents are untouched. Tip: if the target has a ToC, update it in Word with Ctrl+A, then F9.</li>
              <li><strong>Master Docs</strong> (project mode) — append each interview to a shared, cloud-stored document that aggregates the whole project.</li>
            </ul>
          </section>

          <section>
            <h3>Projects</h3>
            <ul>
              <li>Sign in and open <strong>My Projects</strong> to create one. All settings auto-save per project, so a whole engagement uses one consistent template.</li>
              <li>Store transcripts, formatted notes, and master docs in the project's file browser.</li>
              <li><strong>Share</strong> a project by email — teammates need to have signed in at least once.</li>
              <li>Click the logo in the header to reset inputs for the next interview (project settings stay).</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
