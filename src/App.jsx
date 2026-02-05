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
import { formatNotes, getDefaultTakeawaysGuidance, parseQuantCategories, parseRespondentInfo } from './services/claude'
import { exportToWord, DEFAULT_CONFIG } from './services/export'
import { savePreset } from './services/firebase'
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
  const [detailLevel, setDetailLevel] = useState('balanced')
  const [quantCategories, setQuantCategories] = useState([])
  const [coverageLevel, setCoverageLevel] = useState('exhaustive')
  const [takeawayBullet, setTakeawayBullet] = useState('\u2022')
  const [discussionBullet, setDiscussionBullet] = useState('\u2022')
  const [formality, setFormality] = useState('standard')
  const [discussionQuestionFormat, setDiscussionQuestionFormat] = useState('questions')
  const [customStyleInstructions, setCustomStyleInstructions] = useState('Please be exhaustive and detailed, drawing on the source material')
  const [output, setOutput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Project state
  const [currentProject, setCurrentProject] = useState(null)
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false)

  // Export modal state
  const [exportModalOpen, setExportModalOpen] = useState(false)

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
      setQuantCategories(currentProject.quantCategories ?? [])
      setCoverageLevel(currentProject.coverageLevel ?? 'exhaustive')
      setTakeawayBullet(currentProject.takeawayBullet ?? '\u2022')
      setDiscussionBullet(currentProject.discussionBullet ?? '\u2022')
      setFormality(currentProject.formality ?? 'standard')
      setDiscussionQuestionFormat(currentProject.discussionQuestionFormat ?? 'questions')
      setCustomStyleInstructions(currentProject.customStyleInstructions ?? 'Please be exhaustive and detailed, drawing on the source material')
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
        quantCategories,
        detailLevel,
        respondentInfo: respondentManuallyEdited ? respondentInfo : null,
        coverageLevel,
        takeawayBullet,
        discussionBullet,
        formality,
        discussionQuestionFormat,
        customStyleInstructions,
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
    setCustomStyleInstructions('Please be exhaustive and detailed, drawing on the source material')
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
      const updatedProject = {
        ...currentProject,
        takeawaysGuidance,
        quantCategories,
        coverageLevel,
        takeawayBullet,
        discussionBullet,
        formality,
        discussionQuestionFormat,
        customStyleInstructions,
      }
      await savePreset(user.uid, updatedProject)
      setCurrentProject(updatedProject)
    }, 1000)

    return () => clearTimeout(timeoutId)
  }, [takeawaysGuidance, quantCategories, coverageLevel, takeawayBullet, discussionBullet, formality, discussionQuestionFormat, customStyleInstructions, currentProject, user])

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-title" onClick={handleReset} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleReset()}>
          <img src={logo} alt="Company logo" className="header-logo" />
          <h1>Notes Formatter</h1>
        </div>
        <UserMenu
          onOpenProjects={() => setProjectSelectorOpen(true)}
          currentProject={currentProject}
        />
      </header>

      <main className={`app-main ${isResizing ? 'resizing' : ''}`} ref={mainRef}>
        <section className="input-panel" style={{ width: `${leftPanelWidth}%` }}>
          <RespondentInput
            value={respondentInfo}
            onChange={handleRespondentChange}
            onClear={handleRespondentClear}
            isManuallyEdited={respondentManuallyEdited}
          />

          <FileInput
            label="Meeting Notes"
            value={notes}
            onChange={setNotes}
            placeholder="Paste your raw meeting notes here, or upload a file..."
          />

          <FileInput
            label="Transcript"
            value={transcript}
            onChange={setTranscript}
            placeholder="Paste the meeting transcript here, or upload a file..."
          />

          <div className="custom-instructions-field">
            <label htmlFor="custom-style">Custom Style Instructions (Optional)</label>
            <textarea
              id="custom-style"
              value={customStyleInstructions}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  setCustomStyleInstructions(e.target.value)
                }
              }}
              className="format-style-textarea"
              rows={3}
              maxLength={500}
              placeholder='Example: "Emphasize cost and ROI insights" or "Use healthcare industry terminology"'
            />
            <p className="field-helper-text">
              Add optional style instructions for tone, vocabulary, or what to emphasize. ({customStyleInstructions.length}/500)
            </p>
          </div>

          <PromptSettings
            takeawaysGuidance={takeawaysGuidance}
            onTakeawaysChange={setTakeawaysGuidance}
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
          />
        </section>
      </main>

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
      />

      <ProjectSelector
        isOpen={projectSelectorOpen}
        onClose={() => setProjectSelectorOpen(false)}
        currentProject={currentProject}
        onSelectProject={handleSelectProject}
        onOneOffMode={handleOneOffMode}
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
