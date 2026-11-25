import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { AuthContext } from '../hooks/contexts'
import { hasStoredSession } from '../lib/auth'
import { clearPhotoCache } from '../lib/photos'

function AuthProvider({ children }) {
  // 起動を待たせないよう、通信せず端末の保存情報だけで判定する
  const [loggedIn, setLoggedIn] = useState(hasStoredSession)
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(hasStoredSession())
      if (_event === 'SIGNED_OUT') clearPhotoCache()
      setUserId(session?.user?.id ?? null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo(
    // 他の端末のログインは残す
    () => ({ loggedIn, userId, logout: () => supabase.auth.signOut({ scope: 'local' }) }),
    [loggedIn, userId]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
