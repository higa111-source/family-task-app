export const AUTH_STORAGE_KEY = 'family-task-auth'

// ログイン情報が端末に残っているか。
// 通信エラー中も残るため、「圏外」と「ログアウト」を区別できる。
export function hasStoredSession() {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

