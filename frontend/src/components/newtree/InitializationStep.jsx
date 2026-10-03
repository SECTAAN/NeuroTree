/**
 * InitializationStep — Step 1 (10.10.2)
 * Collects Tree Name and Learning Goal.
 */
export default function InitializationStep({ metadata, onChange }) {
  const { treeName, learningGoal } = metadata
  const isValid = treeName.trim().length > 0 && learningGoal.trim().length > 0

  return (
    <div className="animate-[fadeUp_0.3s_ease_forwards]">
      <h2 className="text-base font-semibold text-white/90 mb-1">Initialize Your Tree</h2>
      <p className="text-sm text-white/40 mb-6">Define what you want to learn and why.</p>

      {/* Tree Name */}
      <label className="block mb-5">
        <span className="text-xs text-white/45 uppercase tracking-widest block mb-2">Tree Name</span>
        <input
          type="text"
          value={treeName}
          onChange={(e) => onChange({ treeName: e.target.value })}
          placeholder="e.g. Computer Networks"
          maxLength={80}
          className="w-full rounded-xl px-4 py-2.5 text-sm text-white/90 outline-none
            bg-white/5 border border-white/10 focus:border-cyan-400/40
            placeholder:text-white/20 transition-colors"
          style={{ caretColor: '#00F3FF' }}
        />
      </label>

      {/* Learning Goal */}
      <label className="block mb-2">
        <span className="text-xs text-white/45 uppercase tracking-widest block mb-2">Learning Goal</span>
        <textarea
          value={learningGoal}
          onChange={(e) => onChange({ learningGoal: e.target.value })}
          placeholder="What do you want to achieve?"
          maxLength={200}
          rows={3}
          className="w-full rounded-xl px-4 py-3 text-sm text-white/90 outline-none resize-none
            bg-white/5 border border-white/10 focus:border-cyan-400/40
            placeholder:text-white/20 transition-colors"
          style={{ caretColor: '#00F3FF' }}
        />
        <span className="text-xs text-white/20 float-right mt-1">
          {learningGoal.length}/200
        </span>
      </label>

      {/* Inline hint if empty */}
      {!isValid && (treeName.length > 0 || learningGoal.length > 0) && (
        <p className="text-xs text-white/30 mt-3 clear-right">
          Please fill in both fields to continue.
        </p>
      )}
    </div>
  )
}
