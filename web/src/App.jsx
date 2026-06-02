import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import ProtectedRoute from './auth/ProtectedRoute'
import Login from './auth/Login'
import StudentDashboard from './pages/StudentDashboard'
import CoachDashboard from './pages/CoachDashboard'
import SuperadminDashboard from './pages/SuperadminDashboard'

// Root path: route to the dashboard that matches the user's role.
function Home() {
  const { profile, loading } = useAuth()
  if (loading) return null
  if (!profile) return <Navigate to="/login" replace />
  switch (profile.role) {
    case 'superadmin': return <Navigate to="/admin" replace />
    case 'coach':      return <Navigate to="/coach" replace />
    default:           return <Navigate to="/student" replace />
  }
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Home />} />
          <Route path="/student" element={
            <ProtectedRoute allow={['student','coach','superadmin']}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/coach" element={
            <ProtectedRoute allow={['coach','superadmin']}><CoachDashboard /></ProtectedRoute>} />
          <Route path="/admin" element={
            <ProtectedRoute allow={['superadmin']}><SuperadminDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
