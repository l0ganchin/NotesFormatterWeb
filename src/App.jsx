import { useState, useEffect, useRef, useCallback } from 'react'
import FileInput from './components/FileInput'
import ApiKeyInput from './components/ApiKeyInput'
import RespondentInput from './components/RespondentInput'
import PromptSettings from './components/PromptSettings'
import QuantSettings from './components/QuantSettings'
import OutputDisplay from './components/OutputDisplay'
import ExportModal from './components/ExportModal'
import { formatNotes, getDefaultTakeawaysGuidance, parseQuantCategories, parseRespondentInfo } from './services/claude'
import { exportToWord, exportToPdf } from './services/export'
import logo from './assets/logo.png'
import './App.css'

const API_KEY_STORAGE_KEY = 'notes-formatter-api-key'
const PANEL_WIDTH_STORAGE_KEY = 'notes-formatter-panel-width'

function App() {
  const [transcript, setTranscript] = useState('')
  const [notes, setNotes] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [respondentInfo, setRespondentInfo] = useState({ name: '', role: '', company: '' })
  const [respondentManuallyEdited, setRespondentManuallyEdited] = useState(false)
  const [takeawaysGuidance, setTakeawaysGuidance] = useState(getDefaultTakeawaysGuidance())
  const [detailLevel, setDetailLevel] = useState('balanced')
  const [quantCategories, setQuantCategories] = useState([])
  const [output, setOutput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Export modal state
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportType, setExportType] = useState(null) // 'word' or 'pdf'

  // Resizable panel state
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    const saved = localStorage.getItem(PANEL_WIDTH_STORAGE_KEY)
    return saved ? parseInt(saved, 10) : 50 // percentage
  })
  const [isResizing, setIsResizing] = useState(false)
  const mainRef = useRef(null)

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem(API_KEY_STORAGE_KEY)
    if (savedKey) {
      setApiKey(savedKey)
    }
  }, [])

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

    // Clamp between 30% and 70%
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

  // Save API key to localStorage when it changes
  const handleApiKeyChange = (key) => {
    setApiKey(key)
    if (key) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key)
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY)
    }
  }

  const handleFormat = async () => {
    if (!apiKey) {
      setError('Please enter your Claude API key')
      return
    }
    if (!transcript && !notes) {
      setError('Please provide at least a transcript or notes')
      return
    }

    setError('')
    setIsLoading(true)
    setOutput('')

    try {
      const result = await formatNotes(transcript, notes, apiKey, {
        takeawaysGuidance,
        quantCategories,
        detailLevel,
        respondentInfo: respondentManuallyEdited ? respondentInfo : null,
        onChunk: (partialOutput) => {
          setOutput(partialOutput)
        },
      })
      setOutput(result)

      // Auto-fill respondent info from output if not manually edited
      if (!respondentManuallyEdited) {
        const detectedInfo = parseRespondentInfo(result)
        if (detectedInfo.name || detectedInfo.role || detectedInfo.company) {
          setRespondentInfo(detectedInfo)
        }
      }

      // Auto-fill quant categories from output if in auto-detect mode
      if (quantCategories.length === 0) {
        const detectedCategories = parseQuantCategories(result)
        if (detectedCategories.length > 0) {
          setQuantCategories(detectedCategories)
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to format notes')
    } finally {
      setIsLoading(false)
    }
  }

  const canSubmit = apiKey && (transcript || notes) && !isLoading

  const handleRespondentChange = (newInfo) => {
    setRespondentInfo(newInfo)
    // Mark as manually edited if user types anything
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
    setExportType('word')
    setExportModalOpen(true)
  }

  const handleExportPdfClick = () => {
    if (!output) return
    setExportType('pdf')
    setExportModalOpen(true)
  }

  const handleExport = async ({ mode, existingFile }) => {
    if (exportType === 'word') {
      await exportToWord(output, { mode, existingFile })
    } else {
      await exportToPdf(output, { mode, existingFile })
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-title">
          <img src={logo} alt="Company logo" className="header-logo" />
          <h1>Notes Formatter</h1>
        </div>
      </header>

      <main className={`app-main ${isResizing ? 'resizing' : ''}`} ref={mainRef}>
        <section className="input-panel" style={{ width: `${leftPanelWidth}%` }}>
          <ApiKeyInput apiKey={apiKey} onChange={handleApiKeyChange} />

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

          <PromptSettings
            takeawaysGuidance={takeawaysGuidance}
            onTakeawaysChange={setTakeawaysGuidance}
            detailLevel={detailLevel}
            onDetailLevelChange={setDetailLevel}
          />

          <QuantSettings
            categories={quantCategories}
            onCategoriesChange={setQuantCategories}
          />

          {error && <div className="error-message">{error}</div>}

          <button
            className="format-btn"
            onClick={handleFormat}
            disabled={!canSubmit}
          >
            {isLoading ? 'Formatting...' : 'Format Notes'}
          </button>
        </section>

        <div className="panel-resizer" onMouseDown={handleMouseDown}>
          <div className="resizer-handle" />
        </div>

        <section className="output-panel" style={{ width: `${100 - leftPanelWidth}%` }}>
          <OutputDisplay
            content={output}
            isLoading={isLoading}
            onExportWord={handleExportWordClick}
            onExportPdf={handleExportPdfClick}
          />
        </section>
      </main>

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
        exportType={exportType}
      />
    </div>
  )
}

export default App
