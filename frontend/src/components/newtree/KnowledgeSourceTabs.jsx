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
 * KnowledgeSourceTabs — three-tab source selector (10.11.1)
 */
export default function KnowledgeSourceTabs({ source, onChange }) {
  const [activeTab, setActiveTab] = useState(source.sourceType ?? 'text')

  function switchTab(id) {
    setActiveTab(id)
    onChange({ sourceType: id })
  }

  return (
    <div>
      {/* Tab list */}
      <div className="nt-tab-bar flex rounded-xl p-1 mb-5 gap-1" role="tablist">
        {TABS.map((tab) => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => switchTab(tab.id)}
              className={[
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs',
                'transition-all duration-200 whitespace-nowrap overflow-hidden',
                active ? 'nt-tab-active font-medium' : '',
              ].join(' ')}
              style={{
                color: active ? 'var(--nt-text)' : 'var(--nt-text-3)',
                border: active ? '1px solid var(--nt-border)' : '1px solid transparent',
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
