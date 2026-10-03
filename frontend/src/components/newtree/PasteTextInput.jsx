/**
 * PasteTextInput — Tab 1 (10.11.2)
 * Large textarea for pasting raw text material.
 */
export default function PasteTextInput({ value, onChange }) {
  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste your learning material here..."
        rows={9}
        className="w-full rounded-2xl px-4 py-3 text-sm text-white/85 outline-none resize-none
          bg-white/5 border border-white/10 focus:border-cyan-400/30
          placeholder:text-white/20 transition-colors leading-relaxed"
        style={{ caretColor: '#00F3FF' }}
        maxLength={5000}
      />
      <div className="flex justify-between text-xs text-white/25 px-1">
        <span>{value.length > 0 ? `${value.length.toLocaleString()} characters` : 'No content yet'}</span>
        <span>max 5,000</span>
      </div>
    </div>
  )
}
