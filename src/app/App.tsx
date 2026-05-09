import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '../layout/AppLayout'
import { AdminSettingsPage } from '../pages/AdminSettingsPage'
import { CloseoutDetailPage } from '../pages/CloseoutDetailPage'
import { CloseoutHistoryPage } from '../pages/CloseoutHistoryPage'
import { NewCloseoutPage } from '../pages/NewCloseoutPage'

const App = () => {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/closeout-history" replace />} />
        <Route path="/new-closeout" element={<NewCloseoutPage />} />
        <Route path="/closeout-history" element={<CloseoutHistoryPage />} />
        <Route path="/closeout-history/:closeoutId" element={<CloseoutDetailPage />} />
        <Route path="/admin-settings" element={<AdminSettingsPage />} />
        <Route path="*" element={<Navigate to="/closeout-history" replace />} />
      </Route>
    </Routes>
  )
}

export default App
