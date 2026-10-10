/**
 * InitializationStep — Step 1 (10.10.2)
 * Collects Tree Name and Learning Goal.
 */
export default function InitializationStep({ metadata, onChange }) {
  const { treeName, learningGoal } = metadata
  const isValid = treeName.trim().length > 0 && learningGoal.trim().length > 0

  return (
    <div className="animate-[fadeUp_0.3s_ease_forwards]">
      <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--nt-text)' }}>
        Initialize Your Tree
      </h2>
      <p className="text-sm mb-6" style={{ color: 'var(--nt-text-3)' }}>
        Define what you want to learn and why.
      </p>

      {/* Tree Name */}
      <label className="block mb-5">
        <span className="nt-section-label block mb-2">Tree Name</span>
        <input
          type="text"
          value={treeName}
          onChange={(e) => onChange({ treeName: e.target.value })}
          placeholder="e.g. Computer Networks"
          maxLength={80}
          className="nt-input w-full rounded-xl px-4 py-2.5 text-sm"
          style={{ caretColor: 'var(--nt-coral)' }}
        />
      </label>

      {/* Learning Goal */}
      <label className="block mb-2">
        <span className="nt-section-label block mb-2">Learning Goal</span>
        <textarea
          value={learningGoal}
          onChange={(e) => onChange({ learningGoal: e.target.value })}
          placeholder="What do you want to achieve?"
          maxLength={200}
          rows={3}
          className="nt-input w-full rounded-xl px-4 py-3 text-sm resize-none"
          style={{ caretColor: 'var(--nt-coral)' }}
        />
        <span className="text-xs float-right mt-1" style={{ color: 'var(--nt-text-muted)' }}>
          {learningGoal.length}/200
        </span>
      </label>

      {/* Inline hint if empty */}
      {!isValid && (treeName.length > 0 || learningGoal.length > 0) && (
        <p className="text-xs mt-3 clear-right" style={{ color: 'var(--nt-coral)' }}>
          Please fill in both fields to continue.
        </p>
      )}
    </div>
  )
}
