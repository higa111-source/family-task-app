import { supabase } from '../supabaseClient'

export const MAX_PHOTOS = 5
const MAX_BYTES = 500000
const CACHE_NAME = 'family-task-photos'
const bucket = () => supabase.storage.from('task-photos')
export const photoPath = (p, small = false) => `${p.item_id}/${p.id}${small ? '_s' : ''}.jpg`

function draw(img, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff' // JPEG は透明を扱えず黒くなるため
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像を変換できません'))), 'image/jpeg', quality)
  })
}

// 元の写真は送らず、端末内で縮小する。描き直すため撮影場所などの情報も消える。
export async function compressPhoto(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    let large
    for (const quality of [0.7, 0.5, 0.3]) {
      large = await draw(img, 1280, quality)
      if (large.size <= MAX_BYTES) break
    }
    if (large.size > MAX_BYTES) throw new Error('縮小しても大きすぎます')
    const small = await draw(img, 240, 0.7)
    return { id: crypto.randomUUID(), large, small, previewUrl: URL.createObjectURL(small) }
  } finally {
    URL.revokeObjectURL(url)
  }
}

// 再試行で同じ画像を送ったときの「既にある」は成功とみなす
async function uploadFile(path, blob) {
  const { error } = await bucket().upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
  if (error && String(error.statusCode) !== '409') throw error
}

export async function uploadPhoto(itemId, photo) {
  const row = { id: photo.id, item_id: itemId }
  await uploadFile(photoPath(row, true), photo.small)
  await uploadFile(photoPath(row), photo.large)
  const { error } = await supabase.from('task_photos').insert([{ ...row, size_bytes: photo.large.size + photo.small.size }])
  if (error && error.code !== '23505') throw error
}

// 画像本体を先に消し、取り残しを防ぐ
export async function deletePhotos(photos) {
  if (photos.length === 0) return true
  const { error: fileError } = await bucket().remove(photos.flatMap((p) => [photoPath(p), photoPath(p, true)]))
  if (fileError) {
    console.error('写真の削除失敗', fileError)
    return false
  }
  const { error } = await supabase.from('task_photos').delete().in('id', photos.map((p) => p.id))
  if (error) console.error('写真の記録の削除失敗', error)
  return !error
}

// 通信量を抑えるため、一度取得した画像は端末に残して使い回す
const urls = new Map()

async function loadPhoto(path) {
  const cache = await globalThis.caches?.open(CACHE_NAME).catch(() => null)
  const key = `/${CACHE_NAME}/${path}`
  const hit = await cache?.match(key)
  if (hit) return URL.createObjectURL(await hit.blob())
  const { data, error } = await bucket().download(path)
  if (error) throw error
  await cache?.put(key, new Response(data)).catch(() => {})
  return URL.createObjectURL(data)
}

export function getPhotoUrl(path) {
  if (!urls.has(path)) {
    urls.set(path, loadPhoto(path).catch((error) => {
      urls.delete(path) // 次に表示するとき再取得する
      throw error
    }))
  }
  return urls.get(path)
}

// 端末に残した画像を消す（ログアウト時）
export async function clearPhotoCache() {
  for (const url of urls.values()) url.then(URL.revokeObjectURL, () => {})
  urls.clear()
  await globalThis.caches?.delete(CACHE_NAME).catch(() => {})
}

export function formatBytes(bytes) {
  return bytes < 1e6 ? `${Math.round(bytes / 1000)}KB` : `${(bytes / 1e6).toFixed(1)}MB`
}
