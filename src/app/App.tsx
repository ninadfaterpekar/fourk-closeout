import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthContext } from './AuthContext'
import { AppLayout } from '../layout/AppLayout'
import { ActivityLogPage } from '../pages/ActivityLogPage'
import { AdminSettingsPage } from '../pages/AdminSettingsPage'
import { CloseoutDetailPage } from '../pages/CloseoutDetailPage'
import { CloseoutHistoryPage } from '../pages/CloseoutHistoryPage'
import { LoginPage } from '../pages/LoginPage'
import { NewCloseoutPage } from '../pages/NewCloseoutPage'

const App = () => {
  const { isAuthenticated, user } = useAuthContext()

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/closeout-history" replace />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/closeout-history" replace />} />
        <Route path="/new-closeout" element={<NewCloseoutPage />} />
        <Route path="/closeout-history" element={<CloseoutHistoryPage />} />
        <Route path="/closeout-history/:closeoutId" element={<CloseoutDetailPage />} />
        <Route path="/admin-settings" element={<AdminSettingsPage />} />
        {user?.role === 'super_admin' && (
          <Route path="/activity-log" element={<ActivityLogPage />} />
        )}
        <Route path="*" element={<Navigate to="/closeout-history" replace />} />
      </Route>
    </Routes>
  )
}

export default App
