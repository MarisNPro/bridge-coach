// Weak-two opening style presets, mapped to an engine `toggles` override.
// 'standard' is the system default (6-10) — we send NO override for it, so the
// default bidding/grading path is untouched and parity is preserved.
export const WEAK2_PRESETS = {
  standard: { min: 6, max: 10 },
  aggressive: { min: 5, max: 11 },
  disciplined: { min: 8, max: 10 },
}

export const WEAK2_KEYS = Object.keys(WEAK2_PRESETS)

// Range a preset resolves to (always defined; falls back to standard).
export function weak2Range(preset) {
  return WEAK2_PRESETS[preset] || WEAK2_PRESETS.standard
}

// The toggles override to send with engine requests, or null for the default.
export function weak2Override(preset) {
  if (!preset || preset === 'standard' || !WEAK2_PRESETS[preset]) return null
  return { weak2_range: { ...WEAK2_PRESETS[preset] } }
}
