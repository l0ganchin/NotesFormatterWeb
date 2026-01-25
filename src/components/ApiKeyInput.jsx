import { useState } from 'react'
import './ApiKeyInput.css'

export default function ApiKeyInput({ apiKey, onChange }) {
  const [showKey, setShowKey] = useState(false)

  return (
    <div className="api-key-input">
      <label htmlFor="api-key">Claude API Key</label>
      <div className="api-key-field">
        <input
          id="api-key"
          type={showKey ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => onChange(e.target.value)}
          placeholder="sk-ant-..."
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="toggle-visibility"
        >
          {showKey ? 'Hide' : 'Show'}
        </button>
      </div>
      <p className="api-key-hint">
        Your API key is stored locally and never sent to any server except Anthropic.
      </p>
    </div>
  )
}
