import { useEffect, useRef } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useSettings } from './settings'

// Syncs display/training settings with the Supabase profile so they follow a
// user across devices. Renders nothing. On login it applies the profile's saved
// prefs to local settings (once per user); thereafter it writes changes back.
const KEYS = ['theme', 'textSize', 'deck', 'feedback']

export default function SettingsSync() {
  const { profile, savePrefs } = useAuth()
  const settings = useSettings()
  const appliedFor = useRef(null)

  // Apply saved prefs once per logged-in user (profile wins over localStorage).
  useEffect(() => {
    if (!profile?.id || appliedFor.current === profile.id) return
    appliedFor.current = profile.id
    const prefs = profile.prefs || {}
    const patch = {}
    for (const k of KEYS) if (prefs[k] !== undefined) patch[k] = prefs[k]
    if (Object.keys(patch).length) settings.set(patch)
  }, [profile, settings])

  // Persist changes back to the profile (only after we've applied for this user).
  useEffect(() => {
    if (!profile?.id || appliedFor.current !== profile.id) return
    savePrefs?.(Object.fromEntries(KEYS.map((k) => [k, settings[k]])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.theme, settings.textSize, settings.deck, settings.feedback])

  return null
}
