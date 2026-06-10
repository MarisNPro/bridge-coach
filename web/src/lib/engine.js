// Thin client for the bridge engine. The engine decides correctness; the UI
// only renders what it returns. Base URL comes from VITE_ENGINE_URL, falling
// back to the deployed Railway engine so the app works without extra config.
const BASE = (import.meta.env.VITE_ENGINE_URL ||
  'https://bridge-coach-production.up.railway.app').replace(/\/+$/, '')

async function post(path, body) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (e) {
    throw new Error('network') // engine unreachable / CORS / offline
  }
  let data = {}
  try { data = await res.json() } catch { /* non-JSON */ }
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : `error ${res.status}`
    throw new Error(detail)
  }
  return data
}

export const getBid = (req) => post('/bid', req)
export const checkConformance = (req) => post('/conformance', req)
export const explainCall = (req) => post('/explain', req)
export const assessDeal = (req) => post('/assess', req)
export const engineBase = () => BASE
