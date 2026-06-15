import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import ProtectedRoute from './auth/ProtectedRoute'
import Login from './auth/Login'
import Welcome from './auth/Welcome'
import SettingsSync from './lib/SettingsSync'

// Route-level code splitting: each screen loads on demand so the initial
// bundle stays small (the heavy play/DDS UI only loads when /play is visited).
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'))
const CoachDashboard = lazy(() => import('./pages/CoachDashboard'))
const SuperadminDashboard = lazy(() => import('./pages/SuperadminDashboard'))
const PlayReview = lazy(() => import('./play/PlayReview'))
const Legal = lazy(() => import('./pages/Legal'))

// Gate for /welcome: needs a session, and shows only once — already-welcomed
// users (welcomed_at set) fall straight through to their dashboard.
function WelcomeRoute() {
  const { session, profile, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  if (profile?.welcomed_at) return <Navigate to="/" replace />
  return <Welcome />
}

// Root path: route to the dashboard that matches the user's role.
function Home() {
  const { profile, loading } = useAuth()
  if (loading) return null
  if (!profile) return <Navigate to="/login" replace />
  if (!profile.welcomed_at) return <Navigate to="/welcome" replace />
  switch (profile.role) {
    case 'superadmin': return <Navigate to="/admin" replace />
    case 'coach':      return <Navigate to="/coach" replace />
    default:           return <Navigate to="/student" replace />
  }
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsSync />
      <BrowserRouter>
        <Suspense fallback={null}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/terms" element={<Legal doc="terms" />} />
          <Route path="/privacy" element={<Legal doc="privacy" />} />
          <Route path="/welcome" element={<WelcomeRoute />} />
          <Route path="/" element={<Home />} />
          <Route path="/student" element={
            <ProtectedRoute allow={['student','coach','superadmin']}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/coach" element={
            <ProtectedRoute allow={['coach','superadmin']}><CoachDashboard /></ProtectedRoute>} />
          <Route path="/admin" element={
            <ProtectedRoute allow={['superadmin']}><SuperadminDashboard /></ProtectedRoute>} />
          <Route path="/play" element={
            <ProtectedRoute allow={['student','coach','superadmin']}><PlayReview /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
