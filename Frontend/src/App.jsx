import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Settings from './pages/Settings'
import Dashboard from './pages/Dashboard'
import FhsDatabase from './pages/FhsDatabase'
import Backup from './pages/Backup'
import BackupData from './pages/BackupData'
import Comparison from './pages/Comparison'
import AutoBackupStatus from './pages/AutoBackupStatus'
import UploadLocalRemote from './pages/UploadLocalRemote'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/fhs-database" element={<FhsDatabase />} />
          <Route path="/backup" element={<Backup />} />
          <Route path="/backup-data" element={<BackupData />} />
          <Route path="/comparison" element={<Comparison />} />
          <Route path="/auto-backup-status" element={<AutoBackupStatus />} />
          <Route path="/upload-local-remote" element={<UploadLocalRemote />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
