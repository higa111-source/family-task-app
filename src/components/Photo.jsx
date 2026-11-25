import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { getPhotoUrl, photoPath } from '../lib/photos'

export function Photo({ photo, small = false, className }) {
  const path = photoPath(photo, small)
  const [result, setResult] = useState({})

  useEffect(() => {
    let active = true
    getPhotoUrl(path).then(
      (url) => active && setResult({ path, url }),
      (error) => {
        console.error('写真の取得失敗', error)
        if (active) setResult({ path, failed: true })
      }
    )
    return () => { active = false }
  }, [path])

  const current = result.path === path ? result : {}
  if (current.url) return <img src={current.url} alt="添付写真" className={className} />
  return <span className={`flex items-center justify-center bg-gray-200 text-xs text-gray-500 ${className}`}>{current.failed ? '表示不可' : '…'}</span>
}

export function PhotoViewer({ photos, index, onMove, onClose }) {
  const photo = photos[index]
  if (!photo) return null
  return (
    <div role="dialog" aria-modal="true" aria-label="写真" className="fixed inset-0 z-40 flex flex-col bg-black pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-between p-2 text-white">
        <button type="button" aria-label="写真を閉じる" onClick={onClose} className="p-2"><X /></button>
        <span className="text-sm">{index + 1} / {photos.length}</span>
        <span className="w-10" />
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center"><Photo photo={photo} className="max-h-full min-h-40 max-w-full min-w-40 object-contain" /></div>
      {photos.length > 1 && (
        <div className="flex justify-around p-3 text-white">
          <button type="button" aria-label="前の写真" disabled={index === 0} onClick={() => onMove(index - 1)} className="p-3 disabled:opacity-25"><ChevronLeft size={28} /></button>
          <button type="button" aria-label="次の写真" disabled={index === photos.length - 1} onClick={() => onMove(index + 1)} className="p-3 disabled:opacity-25"><ChevronRight size={28} /></button>
        </div>
      )}
    </div>
  )
}
