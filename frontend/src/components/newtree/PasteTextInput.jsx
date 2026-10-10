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
        className="nt-input w-full rounded-2xl px-4 py-3 text-sm resize-none leading-relaxed"
        style={{ caretColor: 'var(--nt-coral)' }}
        maxLength={5000}
      />
      <div className="flex justify-between text-xs px-1" style={{ color: 'var(--nt-text-muted)' }}>
        <span>{value.length > 0 ? `${value.length.toLocaleString()} characters` : 'No content yet'}</span>
        <span>max 5,000</span>
      </div>
    </div>
  )
}
