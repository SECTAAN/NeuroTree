import { useState } from 'react'
import PasteTextInput   from './PasteTextInput'
import DocumentUploader from './DocumentUploader'
import CameraScanner    from './CameraScanner'

const TABS = [
  { id: 'text',     icon: '📝', label: 'Paste Text'     },
  { id: 'document', icon: '📄', label: 'Upload Document' },
  { id: 'camera',   icon: '📸', label: 'Camera / Scan'  },
]

/**
 * KnowledgeSourceTabs — Shadcn-style tabs built with pure CSS/React (10.11.1)
 * No external shadcn dependency needed — avoids registry issues.
 */
export default function KnowledgeSourceTabs({ source, onChange }) {
  const [activeTab, setActiveTab] = useState(source.sourceType ?? 'text')

  function switchTab(id) {
    setActiveTab(id)
    // Preserve existing content — only update sourceType
    onChange({ sourceType: id })
  }

  return (
    <div>
      {/* Tab list */}
      <div
        className="flex rounded-xl p-1 mb-5 gap-1"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        role="tablist"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => switchTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs
                transition-all duration-200 whitespace-nowrap overflow-hidden"
              style={{
                background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                color:      active ? 'rgba(240,242,245,0.9)' : 'rgba(255,255,255,0.35)',
                border:     active ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                boxShadow:  active ? '0 0 8px rgba(0,243,255,0.08)' : 'none',
                fontWeight: active ? 500 : 400,
              }}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab panels */}
      <div role="tabpanel">
        {activeTab === 'text' && (
          <PasteTextInput
            value={source.text}
            onChange={(text) => onChange({ sourceType: 'text', text })}
          />
        )}
        {activeTab === 'document' && (
          <DocumentUploader
            files={source.files}
            onFiles={(files) => onChange({ sourceType: 'document', files })}
          />
        )}
        {activeTab === 'camera' && (
          <CameraScanner
            images={source.images}
            onImages={(images) => onChange({ sourceType: 'image', images })}
          />
        )}
      </div>
    </div>
  )
}
