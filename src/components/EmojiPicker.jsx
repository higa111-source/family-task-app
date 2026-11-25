import { useState } from 'react'
import { INPUT_CLASS } from '../lib/ui'

// Webからは絵文字キーボードを直接開けないため、一覧から選べるようにする
function EmojiPicker({ value, onChange, choices, label = '絵文字' }) {
  const [custom, setCustom] = useState(false)
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm text-gray-600">{label}</legend>
      <div className="grid max-h-44 grid-cols-7 gap-1 overflow-y-auto">
        {choices.map((emoji) => (
          <button key={emoji} type="button" aria-label={`絵文字 ${emoji}`} aria-pressed={value === emoji} onClick={() => onChange(emoji)}
            className={`rounded-lg border-2 py-1 text-2xl ${value === emoji ? 'border-emerald-700 bg-emerald-50' : 'border-transparent'}`}>{emoji}</button>
        ))}
      </div>
      {custom
        ? <input aria-label={`${label}を入力`} maxLength={16} value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS} />
        : <button type="button" onClick={() => setCustom(true)} className="py-1 text-sm text-gray-500 underline">一覧にない絵文字を入力</button>}
    </fieldset>
  )
}

export default EmojiPicker
