import KnowledgeSourceTabs from './KnowledgeSourceTabs'

/**
 * KnowledgeSourceStep — Step 2 (10.11)
 * Hosts the three-tab source selector and validates before allow proceed.
 */
export default function KnowledgeSourceStep({ source, onChange }) {
  return (
    <div className="animate-[fadeUp_0.3s_ease_forwards]">
      <h2 className="text-base font-semibold text-white/90 mb-1">Add Knowledge Source</h2>
      <p className="text-sm text-white/40 mb-6">Give NeuroTree the material you want to learn.</p>

      <KnowledgeSourceTabs source={source} onChange={onChange} />
    </div>
  )
}
