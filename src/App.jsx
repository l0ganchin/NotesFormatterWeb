import { useState, useEffect, useRef, useCallback } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import FileInput from './components/FileInput'
import RespondentInput from './components/RespondentInput'
import PromptSettings from './components/PromptSettings'
import QuantSettings from './components/QuantSettings'
import FormatStyleSettings from './components/FormatStyleSettings'
import OutputDisplay from './components/OutputDisplay'
import ExportModal from './components/ExportModal'
import UserMenu from './components/UserMenu'
import ProjectSelector from './components/ProjectSelector'
import ProjectFiles from './components/ProjectFiles'
import ProjectSharing from './components/ProjectSharing'
import { formatNotes, getDefaultTakeawaysGuidance, parseQuantCategories, parseRespondentInfo } from './services/claude'
import { exportToWord, DEFAULT_CONFIG } from './services/export'
import { updateProject } from './services/firebase'
import logo from './assets/logo.png'
import './App.css'

const PANEL_WIDTH_STORAGE_KEY = 'notes-formatter-panel-width'


function AppContent() {
  const { user } = useAuth()

  const [transcript, setTranscript] = useState('')
  const [notes, setNotes] = useState('')
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY || ''
  const [respondentInfo, setRespondentInfo] = useState({ name: '', role: '', company: '' })
  const [respondentManuallyEdited, setRespondentManuallyEdited] = useState(false)
  const [takeawaysGuidance, setTakeawaysGuidance] = useState(getDefaultTakeawaysGuidance())
  const [takeawayPreset, setTakeawayPreset] = useState('customer')
  const [detailLevel, setDetailLevel] = useState('balanced')
  const [quantCategories, setQuantCategories] = useState([])
  const [coverageLevel, setCoverageLevel] = useState('exhaustive')
  const [takeawayBullet, setTakeawayBullet] = useState('\u2022')
  const [discussionBullet, setDiscussionBullet] = useState('\u2022')
  const [formality, setFormality] = useState('standard')
  const [discussionQuestionFormat, setDiscussionQuestionFormat] = useState('questions')
  const [customStyleInstructions, setCustomStyleInstructions] = useState('Please be exhaustive and detailed, drawing on the source material. Include all details valuable to the conversation. Rewrite bullets as full sentences with added context so someone who didn\'t attend the call can easily follow. Full sentences only, formal language. Neutral in tone. Make at least 6 pages as content allows.')
  const [projectContext, setProjectContext] = useState('')
  const [output, setOutput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Project state
  const [currentProject, setCurrentProject] = useState(null)
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false)

  // Export modal state
  const [exportModalOpen, setExportModalOpen] = useState(false)

  // Project sharing modal state
  const [sharingProject, setSharingProject] = useState(null)

  // Project files panel - starts open when a project is active
  const [projectFilesOpen, setProjectFilesOpen] = useState(true)

  // Resizable panel state
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    const saved = localStorage.getItem(PANEL_WIDTH_STORAGE_KEY)
    return saved ? parseInt(saved, 10) : 50
  })
  const [isResizing, setIsResizing] = useState(false)
  const mainRef = useRef(null)
  const abortControllerRef = useRef(null)

  // Load project settings when project changes
  useEffect(() => {
    if (currentProject) {
      // Use nullish coalescing to preserve empty string (autodetect mode)
      setTakeawaysGuidance(currentProject.takeawaysGuidance ?? '')
      setTakeawayPreset(currentProject.takeawayPreset ?? 'customer')
      setQuantCategories(currentProject.quantCategories ?? [])
      setCoverageLevel(currentProject.coverageLevel ?? 'exhaustive')
      setTakeawayBullet(currentProject.takeawayBullet ?? '\u2022')
      setDiscussionBullet(currentProject.discussionBullet ?? '\u2022')
      setFormality(currentProject.formality ?? 'standard')
      setDiscussionQuestionFormat(currentProject.discussionQuestionFormat ?? 'questions')
      setCustomStyleInstructions(currentProject.customStyleInstructions ?? 'Please be exhaustive and detailed, drawing on the source material. Include all details valuable to the conversation. Rewrite bullets as full sentences with added context so someone who didn\'t attend the call can easily follow. Full sentences only, formal language. Neutral in tone. Make at least 6 pages as content allows.')
      setProjectContext(currentProject.projectContext ?? '')
    }
  }, [currentProject])

  // Handle resize drag
  const handleMouseDown = useCallback((e) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (!isResizing || !mainRef.current) return

    const container = mainRef.current
    const containerRect = container.getBoundingClientRect()
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100

    const clampedWidth = Math.min(70, Math.max(30, newWidth))
    setLeftPanelWidth(clampedWidth)
  }, [isResizing])

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false)
      localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, leftPanelWidth.toString())
    }
  }, [isResizing, leftPanelWidth])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  const handleFormat = async () => {
    if (!apiKey) {
      setError('API key not configured. Please set VITE_CLAUDE_API_KEY in your .env file.')
      return
    }
    if (!transcript && !notes) {
      setError('Please provide at least a transcript or notes')
      return
    }

    setError('')
    setIsLoading(true)
    setOutput('')

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController()

    try {
      const result = await formatNotes(transcript, notes, apiKey, {
        takeawaysGuidance,
        takeawayPreset,
        quantCategories,
        detailLevel,
        respondentInfo: respondentManuallyEdited ? respondentInfo : null,
        coverageLevel,
        takeawayBullet,
        discussionBullet,
        formality,
        discussionQuestionFormat,
        customStyleInstructions,
        projectContext,
        onChunk: (partialOutput) => {
          setOutput(partialOutput)
        },
        abortSignal: abortControllerRef.current.signal,
      })
      setOutput(result)

      if (!respondentManuallyEdited) {
        const detectedInfo = parseRespondentInfo(result)
        if (detectedInfo.name || detectedInfo.role || detectedInfo.company) {
          setRespondentInfo(detectedInfo)
        }
      }

      if (quantCategories.length === 0) {
        const detectedCategories = parseQuantCategories(result)
        if (detectedCategories.length > 0) {
          setQuantCategories(detectedCategories)
        }
      }
    } catch (err) {
      // Don't show error if user cancelled the request
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to format notes')
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const handleReset = () => {
    // Stop any in-progress formatting
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    // Clear all inputs and output
    setTranscript('')
    setNotes('')
    setRespondentInfo({ name: '', role: '', company: '' })
    setRespondentManuallyEdited(false)
    setCustomStyleInstructions('Please be exhaustive and detailed, drawing on the source material. Include all details valuable to the conversation. Rewrite bullets as full sentences with added context so someone who didn\'t attend the call can easily follow. Full sentences only, formal language. Neutral in tone. Make at least 6 pages as content allows.')
    setProjectContext('')
    setOutput('')
    setError('')
  }

  const canSubmit = apiKey && (transcript || notes) && !isLoading

  const handleRespondentChange = (newInfo) => {
    setRespondentInfo(newInfo)
    if (newInfo.name || newInfo.role || newInfo.company) {
      setRespondentManuallyEdited(true)
    }
  }

  const handleRespondentClear = () => {
    setRespondentInfo({ name: '', role: '', company: '' })
    setRespondentManuallyEdited(false)
  }

  const handleExportWordClick = () => {
    if (!output) return
    setExportModalOpen(true)
  }

  const handleExport = async ({ mode, existingFile }) => {
    // Build custom config with user-selected bullet characters
    const customConfig = {
      ...DEFAULT_CONFIG,
      takeaway_bullet: {
        ...DEFAULT_CONFIG.takeaway_bullet,
        bullet: takeawayBullet,
      },
      discussion_bullet: {
        ...DEFAULT_CONFIG.discussion_bullet,
        bullet: discussionBullet,
      },
      quant_bullet: {
        ...DEFAULT_CONFIG.quant_bullet,
        bullet: discussionBullet, // Use discussion bullet for quant
      },
    }
    await exportToWord(output, { mode, existingFile, config: customConfig, respondentInfo })
  }

  const handleSelectProject = (project) => {
    setCurrentProject(project)
  }

  const handleOneOffMode = () => {
    setCurrentProject(null)
  }

  // Save project settings when they change (debounced)
  useEffect(() => {
    if (!currentProject || !user) return

    const timeoutId = setTimeout(async () => {
      try {
        await updateProject(currentProject.id, {
          takeawaysGuidance,
          takeawayPreset,
          quantCategories,
          coverageLevel,
          takeawayBullet,
          discussionBullet,
          formality,
          discussionQuestionFormat,
          customStyleInstructions,
          projectContext,
        })
      } catch (err) {
        console.warn('Failed to auto-save project settings:', err)
      }
    }, 1000)

    return () => clearTimeout(timeoutId)
  }, [takeawaysGuidance, takeawayPreset, quantCategories, coverageLevel, takeawayBullet, discussionBullet, formality, discussionQuestionFormat, customStyleInstructions, projectContext, currentProject, user])

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-title" onClick={handleReset} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleReset()}>
          <img src={logo} alt="Company logo" className="header-logo" />
          <h1>Notes Formatter</h1>
        </div>
        <UserMenu
          onOpenProjects={() => setProjectSelectorOpen(true)}
          onOpenSharing={(project) => setSharingProject(project)}
          currentProject={currentProject}
        />
      </header>

      <main className={`app-main ${isResizing ? 'resizing' : ''}`} ref={mainRef}>
        <section className="input-panel" style={{ width: `${leftPanelWidth}%` }}>
          {/* Project Files Browser - only visible when a project is selected */}
          {currentProject && (
            <ProjectFiles
              projectId={currentProject.id}
              isOpen={projectFilesOpen}
              onToggle={() => setProjectFilesOpen(!projectFilesOpen)}
              user={user}
              transcript={transcript}
              notes={notes}
              respondentInfo={respondentInfo}
            />
          )}

          <RespondentInput
            value={respondentInfo}
            onChange={handleRespondentChange}
            onClear={handleRespondentClear}
            isManuallyEdited={respondentManuallyEdited}
          />

          <FileInput
            label="Transcript"
            value={transcript}
            onChange={setTranscript}
            placeholder="Paste the meeting transcript here, or upload a file..."
          />

          <FileInput
            label="Meeting Notes (optional)"
            value={notes}
            onChange={setNotes}
            placeholder="Paste your raw meeting notes here, or upload a file..."
          />

          <div className="custom-instructions-field">
            <label htmlFor="custom-style">Custom Style Instructions</label>
            <textarea
              id="custom-style"
              value={customStyleInstructions}
              onChange={(e) => {
                if (e.target.value.length <= 1000) {
                  setCustomStyleInstructions(e.target.value)
                }
              }}
              className="format-style-textarea"
              rows={3}
              maxLength={1000}
              placeholder='e.g., "Emphasize cost and ROI insights" or "Use healthcare industry terminology"'
            />
            <p className="field-helper-text">
              Style instructions for tone, detail level, sentence structure, and what to emphasize. ({customStyleInstructions.length}/1000)
            </p>
          </div>

          <div className="custom-instructions-field">
            <label htmlFor="project-context">Project Context (Optional)</label>
            <textarea
              id="project-context"
              value={projectContext}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  setProjectContext(e.target.value)
                }
              }}
              className="format-style-textarea"
              rows={2}
              maxLength={500}
              placeholder='e.g., "3 interviewees from Harry&#39;s (client of Harvest), Charles is on our team and is interviewing. Focus on details valuable to Harvest and the client relationship."'
            />
            <p className="field-helper-text">
              Identify who is who — client vs. team members, company names, and what to focus on. ({projectContext.length}/500)
            </p>
          </div>

          <PromptSettings
            takeawaysGuidance={takeawaysGuidance}
            onTakeawaysChange={setTakeawaysGuidance}
            takeawayPreset={takeawayPreset}
            onPresetChange={setTakeawayPreset}
          />

          <QuantSettings
            categories={quantCategories}
            onCategoriesChange={setQuantCategories}
          />

          <FormatStyleSettings
            coverageLevel={coverageLevel}
            onCoverageLevelChange={setCoverageLevel}
            detailLevel={detailLevel}
            onDetailLevelChange={setDetailLevel}
            takeawayBullet={takeawayBullet}
            onTakeawayBulletChange={setTakeawayBullet}
            discussionBullet={discussionBullet}
            onDiscussionBulletChange={setDiscussionBullet}
            discussionQuestionFormat={discussionQuestionFormat}
            onDiscussionQuestionFormatChange={setDiscussionQuestionFormat}
            formality={formality}
            onFormalityChange={setFormality}
          />

          {error && <div className="error-message">{error}</div>}

          <div className="format-btn-group">
            <button
              className="format-btn"
              onClick={handleFormat}
              disabled={!canSubmit}
            >
              {isLoading ? 'Formatting...' : 'Format Notes'}
            </button>
            {isLoading && (
              <button
                className="stop-btn"
                onClick={handleStop}
                type="button"
              >
                Stop
              </button>
            )}
          </div>
        </section>

        <div className="panel-resizer" onMouseDown={handleMouseDown}>
          <div className="resizer-handle" />
        </div>

        <section className="output-panel" style={{ width: `${100 - leftPanelWidth}%` }}>
          <OutputDisplay
            content={output}
            isLoading={isLoading}
            onExportWord={handleExportWordClick}
            takeawayBullet={takeawayBullet}
            discussionBullet={discussionBullet}
            currentProject={currentProject}
            user={user}
            respondentInfo={respondentInfo}
            transcript={transcript}
            notes={notes}
          />
        </section>
      </main>

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
        currentProject={currentProject}
        user={user}
        respondentInfo={respondentInfo}
        output={output}
        takeawayBullet={takeawayBullet}
        discussionBullet={discussionBullet}
      />

      <ProjectSelector
        isOpen={projectSelectorOpen}
        onClose={() => setProjectSelectorOpen(false)}
        currentProject={currentProject}
        onSelectProject={handleSelectProject}
        onOneOffMode={handleOneOffMode}
        onOpenSharing={(project) => {
          setProjectSelectorOpen(false)
          setSharingProject(project)
        }}
      />

      <ProjectSharing
        isOpen={!!sharingProject}
        onClose={() => setSharingProject(null)}
        project={sharingProject}
      />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
