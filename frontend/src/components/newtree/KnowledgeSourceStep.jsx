/**
 * KnowledgeSourceStep — Step 2 (10.11)
 * Hosts the three-tab source selector and validates before allow proceed.
 */
import KnowledgeSourceTabs from './KnowledgeSourceTabs'

export default function KnowledgeSourceStep({ source, onChange }) {
  return (
    <div className="animate-[fadeUp_0.3s_ease_forwards]">
      <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--nt-text)' }}>
        Add Knowledge Source
      </h2>
      <p className="text-sm mb-6" style={{ color: 'var(--nt-text-3)' }}>
        Give NeuroTree the material you want to learn.
      </p>

      <KnowledgeSourceTabs source={source} onChange={onChange} />
    </div>
  )
}
