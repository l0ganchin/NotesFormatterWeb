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
import ProjectSharing from './components/ProjectSharing'
import HowToGuide from './components/HowToGuide'
import WhatsNew, { WHATS_NEW_VERSION } from './components/WhatsNew'
import PresetPillNav from './components/PresetPillNav'
import WGAttendeesPicker from './components/WGAttendeesPicker'
import SavePresetAsModal from './components/SavePresetAsModal'
import ProjectMetadata from './components/ProjectMetadata'
import { formatNotes, parseQuantCategories, parseRespondentInfo } from './services/claude'
import { exportToWord, buildExportConfig, buildDocumentTitle } from './services/export'
import { updateProject, createProject } from './services/firebase'
import {
  PRESET_KEYS,
  buildDefaultPreset,
  buildAllDefaultPresets,
  normalizePreset,
  migrateProjectToPresets,
  todayISO,
} from './services/presets'
import logo from './assets/Logo.png'
import './App.css'

const PANEL_WIDTH_STORAGE_KEY = 'notes-formatter-panel-width'
const WHATS_NEW_STORAGE_KEY = 'notes-formatter-whats-new-seen'

// Initial form values: the Customer preset's defaults (customer is the
// starting pill)
const INITIAL_PRESET = buildDefaultPreset('customer')

function AppContent() {
  const { user } = useAuth()

  // ---- Per-note state (never saved to a preset) ----
  const [transcript, setTranscript] = useState('')
  const [notes, setNotes] = useState('')
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY || ''
  const [respondentInfo, setRespondentInfo] = useState({ name: '', role: '', company: '' })
  const [respondentManuallyEdited, setRespondentManuallyEdited] = useState(false)
  const [interviewDate, setInterviewDate] = useState(todayISO())
  const [extraAttendees, setExtraAttendees] = useState([])
  const [output, setOutput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  // ---- Preset-scoped state (saved per call type when Save is hit) ----
  const [takeawaysGuidance, setTakeawaysGuidance] = useState(INITIAL_PRESET.takeawaysGuidance)
  const [takeawayPreset, setTakeawayPreset] = useState(INITIAL_PRESET.takeawayPreset)
  const [detailLevel, setDetailLevel] = useState(INITIAL_PRESET.detailLevel)
  const [quantCategories, setQuantCategories] = useState(INITIAL_PRESET.quantCategories)
  const [includeImportance, setIncludeImportance] = useState(INITIAL_PRESET.includeImportance)
  const [coverageLevel, setCoverageLevel] = useState(INITIAL_PRESET.coverageLevel)
  const [takeawayBullet, setTakeawayBullet] = useState(INITIAL_PRESET.takeawayBullet)
  const [discussionBullet, setDiscussionBullet] = useState(INITIAL_PRESET.discussionBullet)
  const [formality, setFormality] = useState(INITIAL_PRESET.formality)
  const [discussionQuestionFormat, setDiscussionQuestionFormat] = useState(INITIAL_PRESET.discussionQuestionFormat)
  const [customStyleInstructions, setCustomStyleInstructions] = useState(INITIAL_PRESET.customStyleInstructions)
  const [projectContext, setProjectContext] = useState(INITIAL_PRESET.projectContext)
  const [wgAttendees, setWgAttendees] = useState(INITIAL_PRESET.wgAttendees)

  // ---- Preset navigation state ----
  // The active pill doubles as the "Type of Call" in the exported header.
  // Unsaved edits on a pill live in presetDrafts when you switch away, so
  // flipping between pills never loses work; savedPresets mirrors Firestore.
  const [activeCallType, setActiveCallType] = useState('customer')
  const [presetDrafts, setPresetDrafts] = useState({ management: null, customer: null, expert: null })
  const [savedPresets, setSavedPresets] = useState(() => buildAllDefaultPresets())
  // Project-level metadata shared by all three presets: the project's actual
  // name (renamed on Save) and the client company (both feed the doc title)
  const [projectName, setProjectName] = useState('')
  const [company, setCompany] = useState('')
  const [isSavingPreset, setIsSavingPreset] = useState(false)
  const [justSavedPreset, setJustSavedPreset] = useState(false)
  const [saveAsOpen, setSaveAsOpen] = useState(false)
  const activeCallTypeRef = useRef('customer')
  const savedFlashTimerRef = useRef(null)

  // Project state
  const [currentProject, setCurrentProject] = useState(null)
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false)

  // Export modal state
  const [exportModalOpen, setExportModalOpen] = useState(false)

  // Project sharing modal state
  const [sharingProject, setSharingProject] = useState(null)

  // How-to-use guide modal state
  const [helpOpen, setHelpOpen] = useState(false)

  // What's New popup: shows once per browser per release version
  const [whatsNewOpen, setWhatsNewOpen] = useState(() => {
    try {
      return localStorage.getItem(WHATS_NEW_STORAGE_KEY) !== WHATS_NEW_VERSION
    } catch {
      return false
    }
  })

  const dismissWhatsNew = () => {
    setWhatsNewOpen(false)
    try {
      localStorage.setItem(WHATS_NEW_STORAGE_KEY, WHATS_NEW_VERSION)
    } catch {
      // Storage unavailable (private mode) — the popup just shows again next visit
    }
  }

  // Resizable panel state
  const [leftPanelWidth, setLeftPanelWidth] = useState(50)
  const [isResizing, setIsResizing] = useState(false)
  const mainRef = useRef(null)
  const abortControllerRef = useRef(null)

  // Streaming throttle: chunks arrive in uneven bursts, so UI updates are
  // flushed on a steady 100ms cadence to keep the output from feeling jumpy
  const pendingOutputRef = useRef('')
  const flushTimerRef = useRef(null)

  const collectCurrentPreset = () =>
    normalizePreset(
      {
        takeawaysGuidance,
        takeawayPreset,
        detailLevel,
        quantCategories,
        includeImportance,
        coverageLevel,
        takeawayBullet,
        discussionBullet,
        formality,
        discussionQuestionFormat,
        customStyleInstructions,
        projectContext,
        wgAttendees,
      },
      activeCallType
    )

  const applyPreset = (preset, callType) => {
    const p = normalizePreset(preset, callType)
    setTakeawaysGuidance(p.takeawaysGuidance)
    setTakeawayPreset(p.takeawayPreset)
    setDetailLevel(p.detailLevel)
    setQuantCategories(p.quantCategories)
    setIncludeImportance(p.includeImportance)
    setCoverageLevel(p.coverageLevel)
    setTakeawayBullet(p.takeawayBullet)
    setDiscussionBullet(p.discussionBullet)
    setFormality(p.formality)
    setDiscussionQuestionFormat(p.discussionQuestionFormat)
    setCustomStyleInstructions(p.customStyleInstructions)
    setProjectContext(p.projectContext)
    setWgAttendees(p.wgAttendees)
  }

  // Load presets when the project changes (guarded by id so in-place project
  // updates after a save don't re-trigger a full reload and clobber drafts)
  const loadedProjectIdRef = useRef(undefined)
  useEffect(() => {
    const projectId = currentProject?.id ?? null
    if (loadedProjectIdRef.current === projectId) return
    loadedProjectIdRef.current = projectId

    let presets
    if (!currentProject) {
      presets = buildAllDefaultPresets()
      setProjectName('')
      setCompany('')
    } else {
      if (currentProject.presets) {
        presets = {}
        for (const key of PRESET_KEYS) {
          presets[key] = normalizePreset(currentProject.presets[key], key)
        }
      } else {
        // Pre-preset project: seed all three presets from its flat settings
        // and write the new shape back once
        presets = migrateProjectToPresets(currentProject)
        updateProject(currentProject.id, { presets }).catch((err) =>
          console.warn('Failed to migrate project to presets:', err)
        )
      }
      setProjectName(currentProject.name ?? '')
      setCompany(currentProject.company ?? '')
    }

    setSavedPresets(presets)
    setPresetDrafts({ management: null, customer: null, expert: null })
    applyPreset(presets[activeCallTypeRef.current], activeCallTypeRef.current)
  }, [currentProject])

  const handleCallTypeChange = (next) => {
    if (next === activeCallType) return
    // Stash the current pill's values so its unsaved edits survive the switch
    setPresetDrafts((prev) => ({ ...prev, [activeCallType]: collectCurrentPreset() }))
    applyPreset(presetDrafts[next] ?? savedPresets[next], next)
    activeCallTypeRef.current = next
    setActiveCallType(next)
  }

  const handleSavePreset = async () => {
    if (!currentProject || !user) return
    setIsSavingPreset(true)
    try {
      const preset = collectCurrentPreset()
      // The Project Name field is linked to the project itself — saving a
      // changed name renames the project everywhere
      const name = projectName.trim() || currentProject.name
      const companyValue = company.trim()
      await updateProject(currentProject.id, {
        [`presets.${activeCallType}`]: preset,
        name,
        company: companyValue,
      })
      setProjectName(name)
      setCompany(companyValue)
      setSavedPresets((prev) => ({ ...prev, [activeCallType]: preset }))
      setPresetDrafts((prev) => ({ ...prev, [activeCallType]: null }))
      setCurrentProject((prev) =>
        prev
          ? { ...prev, name, company: companyValue, presets: { ...(prev.presets || {}), [activeCallType]: preset } }
          : prev
      )
      setJustSavedPreset(true)
      if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current)
      savedFlashTimerRef.current = setTimeout(() => setJustSavedPreset(false), 2000)
    } catch (err) {
      console.error('Failed to save preset:', err)
      setError('Failed to save preset: ' + (err.message || 'unknown error'))
    } finally {
      setIsSavingPreset(false)
    }
  }

  // "Save As": copy the current parameters into any call-type slot of a new
  // or existing project. Called by SavePresetAsModal, which surfaces errors.
  const handleSaveAs = async ({ project, newProjectName, callType }) => {
    if (!user) return
    const preset = normalizePreset(collectCurrentPreset(), callType)

    if (newProjectName) {
      const presets = { ...buildAllDefaultPresets(), [callType]: preset }
      const created = await createProject(user.uid, {
        name: newProjectName,
        company: company.trim(),
        presets,
      })
      // Switch into the new project on its saved pill — the applied preset
      // equals the current values, so the form doesn't change under the user
      activeCallTypeRef.current = callType
      setActiveCallType(callType)
      setCurrentProject(created)
      return
    }

    if (!project.presets) {
      // Legacy flat-settings project: migrate all three presets now, so a
      // partial presets map doesn't shadow its old settings on next load
      const presets = migrateProjectToPresets(project)
      presets[callType] = preset
      await updateProject(project.id, { presets })
    } else {
      await updateProject(project.id, { [`presets.${callType}`]: preset })
    }

    // Saving into the currently open project: sync in-memory state so the
    // dirty indicators reflect the new saved values (no reload — the load
    // effect is keyed on project id)
    if (project.id === currentProject?.id) {
      setSavedPresets((prev) => ({ ...prev, [callType]: preset }))
      setCurrentProject((prev) =>
        prev ? { ...prev, presets: { ...(prev.presets || {}), [callType]: preset } } : prev
      )
    }
  }

  // Dirty tracking: presets are normalized through the same key order, so a
  // simple stringify comparison is reliable
  const isProjectMode = !!currentProject && !!user
  const dirtyByType = {}
  for (const key of PRESET_KEYS) {
    const values = key === activeCallType ? collectCurrentPreset() : presetDrafts[key]
    dirtyByType[key] = !!values && JSON.stringify(values) !== JSON.stringify(savedPresets[key])
  }
  if (isProjectMode && (projectName !== (currentProject.name ?? '') || company !== (currentProject.company ?? ''))) {
    dirtyByType[activeCallType] = true
  }

  // Everything the export header, document title, and metadata block need
  const noteMeta = {
    projectName,
    company,
    callType: activeCallType,
    interviewDate,
    respondentName: respondentInfo.name,
    companyLabel: respondentInfo.company,
    extraAttendees,
    wgAttendees,
  }

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
    setWarning('')
    setIsLoading(true)
    setOutput('')

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController()

    // The manual flag can outlive its content (typed once, then cleared field
    // by field) — empty fields always mean auto-detect, so the speaker still
    // autofills the title and Attendees line
    const hasManualRespondent =
      respondentManuallyEdited && !!(respondentInfo.name || respondentInfo.role || respondentInfo.company)

    try {
      const result = await formatNotes(transcript, notes, apiKey, {
        takeawaysGuidance,
        takeawayPreset,
        quantCategories,
        includeImportance,
        detailLevel,
        respondentInfo: hasManualRespondent ? respondentInfo : null,
        coverageLevel,
        takeawayBullet,
        discussionBullet,
        formality,
        discussionQuestionFormat,
        customStyleInstructions,
        projectContext,
        onChunk: (partialOutput) => {
          pendingOutputRef.current = partialOutput
          if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(() => {
              flushTimerRef.current = null
              setOutput(pendingOutputRef.current)
            }, 100)
          }
        },
        abortSignal: abortControllerRef.current.signal,
      })
      setOutput(result.text)

      if (result.truncated) {
        setWarning('The output hit the model\'s length limit and may be cut off before the end of the transcript. Review the end of the document — consider a more focused coverage level or formatting the interview in sections.')
      }

      if (!hasManualRespondent) {
        const detectedInfo = parseRespondentInfo(result.text)
        if (detectedInfo.name || detectedInfo.role || detectedInfo.company) {
          setRespondentInfo(detectedInfo)
          setRespondentManuallyEdited(false)
        }
      }

      if (quantCategories.length === 0) {
        const detectedCategories = parseQuantCategories(result.text)
        if (detectedCategories.length > 0) {
          setQuantCategories(detectedCategories)
        }
      }

      // Auto-check the Importance toggle when the interview turned out to
      // include importance ratings (mirrors the quant-category auto-fill)
      if (!includeImportance && result.text.includes('**Importance:**')) {
        setIncludeImportance(true)
      }
    } catch (err) {
      // Don't show error if user cancelled the request
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to format notes')
      }
    } finally {
      // Drop any pending throttled flush so it can't fire after completion,
      // an error, or a reset (the success path sets the full text itself)
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
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
    // Clear per-note inputs and output; preset parameters revert to the
    // active pill's saved values
    setTranscript('')
    setNotes('')
    setRespondentInfo({ name: '', role: '', company: '' })
    setRespondentManuallyEdited(false)
    setInterviewDate(todayISO())
    setExtraAttendees([])
    setCustomStyleInstructions(savedPresets[activeCallType].customStyleInstructions)
    setProjectContext(savedPresets[activeCallType].projectContext)
    setOutput('')
    setError('')
    setWarning('')
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
    await exportToWord(output, {
      mode,
      existingFile,
      config: buildExportConfig({ takeawayBullet, discussionBullet }),
      respondentInfo,
      noteMeta,
    })
  }

  const handleSelectProject = (project) => {
    setCurrentProject(project)
  }

  // A project was renamed in the My Projects list — keep the in-memory copy
  // and the metadata field in sync when it's the active one
  const handleProjectRenamed = (projectId, newName) => {
    if (currentProject?.id === projectId) {
      setCurrentProject((prev) => (prev ? { ...prev, name: newName } : prev))
      setProjectName(newName)
    }
  }

  const handleOneOffMode = () => {
    setCurrentProject(null)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="header-title" onClick={handleReset} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleReset()}>
            <img src={logo} alt="Company logo" className="header-logo" />
            <h1>Notes Formatter</h1>
          </div>
          <button
            type="button"
            className="header-info-btn"
            onClick={() => setHelpOpen(true)}
            title="How to use"
            aria-label="How to use this app"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm1 12H7V7h2v5zM8 6a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
        <UserMenu
          onOpenProjects={() => setProjectSelectorOpen(true)}
          onOpenSharing={(project) => setSharingProject(project)}
          currentProject={currentProject}
        />
      </header>

      <main className={`app-main ${isResizing ? 'resizing' : ''}`} ref={mainRef}>
        <section className="input-panel" style={{ width: `${leftPanelWidth}%` }}>
          <PresetPillNav
            activeCallType={activeCallType}
            onChange={handleCallTypeChange}
            dirtyByType={isProjectMode ? dirtyByType : {}}
            isProjectMode={isProjectMode}
            onSave={handleSavePreset}
            isSaving={isSavingPreset}
            justSaved={justSavedPreset}
            canSaveAs={!!user}
            onSaveAs={() => setSaveAsOpen(true)}
          />

          <ProjectMetadata
            projectName={projectName}
            onProjectNameChange={setProjectName}
            company={company}
            onCompanyChange={setCompany}
          />

          <RespondentInput
            value={respondentInfo}
            onChange={handleRespondentChange}
            onClear={handleRespondentClear}
            isManuallyEdited={respondentManuallyEdited}
            interviewDate={interviewDate}
            onInterviewDateChange={setInterviewDate}
            extraAttendees={extraAttendees}
            onExtraAttendeesChange={setExtraAttendees}
          />

          <WGAttendeesPicker value={wgAttendees} onChange={setWgAttendees} />

          <FileInput
            label="Transcript"
            value={transcript}
            onChange={setTranscript}
            placeholder="Paste the meeting transcript here, or upload a file..."
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

          <FileInput
            label="Meeting Notes (optional)"
            value={notes}
            onChange={setNotes}
            placeholder="Paste your raw meeting notes here, or upload a file..."
            collapsible
          />

          <PromptSettings
            takeawaysGuidance={takeawaysGuidance}
            onTakeawaysChange={setTakeawaysGuidance}
            takeawayPreset={takeawayPreset}
            onPresetChange={setTakeawayPreset}
          />

          <QuantSettings
            categories={quantCategories}
            onCategoriesChange={setQuantCategories}
            includeImportance={includeImportance}
            onIncludeImportanceChange={setIncludeImportance}
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
          {warning && <div className="warning-message">{warning}</div>}

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
            noteMeta={noteMeta}
          />
        </section>
      </main>

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
        documentTitle={buildDocumentTitle(noteMeta)}
      />

      <SavePresetAsModal
        isOpen={saveAsOpen}
        onClose={() => setSaveAsOpen(false)}
        onSave={handleSaveAs}
        user={user}
        currentProjectId={currentProject?.id ?? null}
        defaultCallType={activeCallType}
      />

      <ProjectSelector
        isOpen={projectSelectorOpen}
        onClose={() => setProjectSelectorOpen(false)}
        currentProject={currentProject}
        onSelectProject={handleSelectProject}
        onOneOffMode={handleOneOffMode}
        onProjectRenamed={handleProjectRenamed}
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

      <HowToGuide
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
      />

      <WhatsNew
        isOpen={whatsNewOpen}
        onClose={dismissWhatsNew}
        onOpenGuide={() => {
          dismissWhatsNew()
          setHelpOpen(true)
        }}
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
