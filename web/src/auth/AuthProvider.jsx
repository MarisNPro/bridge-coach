import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import i18n from '../i18n'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load the profile row (role, locale, prefs) for the signed-in user.
  // `select('*')` so a not-yet-applied `prefs` column doesn't break the load.
  async function loadProfile(userId) {
    if (!userId) { setProfile(null); return }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) { console.error('profile load failed', error); setProfile(null); return }
    setProfile(data)
    if (data?.locale) i18n.changeLanguage(data.locale)
  }

  // Persist display/training preferences to the profile (fire-and-forget; a
  // missing `prefs` column or offline write simply no-ops — see migration 0007).
  async function savePrefs(prefs) {
    const uid = session?.user?.id
    if (!uid) return
    const { error } = await supabase.from('profiles').update({ prefs }).eq('id', uid)
    if (!error) setProfile((p) => (p ? { ...p, prefs } : p))
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadProfile(data.session?.user?.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s)
      await loadProfile(s?.user?.id)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signOut = () => supabase.auth.signOut()

  // Reload the profile row on demand — used after the onboarding wizard writes
  // onboarded_at so routing re-evaluates needsOnboarding without a full reload.
  const refreshProfile = () => loadProfile(session?.user?.id)

  // OAuth sign-in. The provider config lives in Supabase; on success the user
  // is redirected back to the app origin and onAuthStateChange picks up the
  // session. Dormant until Google credentials are configured in Supabase.
  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })

  // A signed-in user who hasn't finished the onboarding wizard yet. Routing
  // uses this to send them to /onboarding before the dashboards.
  const needsOnboarding = !!session && !!profile && !profile.onboarded_at

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, signOut, savePrefs, refreshProfile, signInWithGoogle, needsOnboarding }}>
      {children}
    </AuthContext.Provider>
  )
}
