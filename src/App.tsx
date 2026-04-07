import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './layouts/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Matrimony from './pages/Matrimony'
import Events from './pages/Events'
import HelpCenter from './pages/HelpCenter'
import Business from './pages/Business'
import CommunityFeed from './pages/CommunityFeed'
import Profile from './pages/Profile'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import authService from './services/auth'

function ProtectedRoute({ children }: { children: JSX.Element }) {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  return children
}

function PublicRoute({ children }: { children: JSX.Element }) {
  if (authService.isAuthenticated()) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        {/* Protected Routes with Layout */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/matrimony" element={<Matrimony />} />
          <Route path="/events" element={<Events />} />
          <Route path="/help-and-need" element={<HelpCenter />} />
          <Route path="/help-center" element={<Navigate to="/help-and-need" replace />} />
          <Route path="/business" element={<Business />} />
          <Route path="/community" element={<CommunityFeed />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<Admin />} />
        </Route>

        {/* Catch-all for undefined routes */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  )
}

export default App
