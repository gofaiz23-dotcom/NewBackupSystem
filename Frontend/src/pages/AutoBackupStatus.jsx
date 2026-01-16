import { useState, useEffect } from 'react'
import Message from '../components/Message/Message'
import './AutoBackupStatus.css'

const AutoBackupStatus = () => {
  const [activeTab, setActiveTab] = useState(null) // 'database' or 'files'
  const [statusData, setStatusData] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    if (activeTab) {
      fetchAutoBackupStatus(activeTab)
      // Auto-refresh every 10 seconds
      const interval = setInterval(() => fetchAutoBackupStatus(activeTab), 10000)
      return () => clearInterval(interval)
    }
  }, [activeTab])

  const fetchAutoBackupStatus = async (tab) => {
    if (!tab) return
    
    try {
      setLoading(true)
      const endpoint = tab === 'database' 
        ? '/api/auto-backup/database'
        : '/api/auto-backup/files'
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${endpoint}`)
      const data = await response.json()

      if (data.success) {
        setStatusData(data.data || [])
        setMessage({ type: '', text: '' })
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to fetch auto-backup status' })
        setStatusData([])
      }
    } catch (error) {
      console.error('Error fetching auto-backup status:', error)
      setMessage({ type: 'error', text: 'Failed to fetch auto-backup status' })
      setStatusData([])
    } finally {
      setLoading(false)
    }
  }

  // Auto-close message after 5 seconds
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => {
        setMessage({ type: '', text: '' })
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [message.text])

  const handleTabClick = (tab) => {
    setActiveTab(tab)
    setStatusData([]) // Clear previous data
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    try {
      return new Date(dateString).toLocaleString()
    } catch {
      return dateString
    }
  }

  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'status-completed'
      case 'failed':
        return 'status-failed'
      case 'processing':
        return 'status-processing'
      default:
        return 'status-unknown'
    }
  }

  return (
    <div className="auto-backup-status-page">
      <div className="page-header">
        <h1>🔄 Auto-Backup Status</h1>
        <button 
          className="refresh-btn" 
          onClick={() => activeTab && fetchAutoBackupStatus(activeTab)} 
          disabled={loading || !activeTab}
        >
          🔄 Refresh
        </button>
      </div>

      {message.text && (
        <Message
          type={message.type}
          message={message.text}
          onClose={() => setMessage({ type: '', text: '' })}
        />
      )}

      <div className="auto-backup-container">
        {/* Tab Buttons */}
        <div className="tab-buttons">
          <button
            className={`tab-btn ${activeTab === 'database' ? 'active' : ''}`}
            onClick={() => handleTabClick('database')}
          >
            📊 Database
          </button>
          <button
            className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => handleTabClick('files')}
          >
            📁 Files
          </button>
        </div>

        {loading && statusData.length === 0 && (
          <div className="loading-container">
            <div className="loading">Loading auto-backup status...</div>
          </div>
        )}

        {/* Database Tab */}
        {activeTab === 'database' && !loading && (
          <div className="status-table-container">
            <h2>Automatic Database Backups</h2>
            {statusData.length > 0 ? (
              <div className="table-wrapper">
                <table className="status-table">
                  <thead>
                    <tr>
                      <th>Job ID</th>
                      <th>Backend</th>
                      <th>Status</th>
                      <th>Progress</th>
                      <th>Message</th>
                      <th>Created At</th>
                      <th>Updated At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusData.map((status) => (
                      <tr key={status.jobId}>
                        <td className="job-id-cell">{status.jobId}</td>
                        <td>{status.backendName}</td>
                        <td>
                          <span className={`status-badge ${getStatusBadgeClass(status.status)}`}>
                            {status.status}
                          </span>
                        </td>
                        <td>{status.progress}%</td>
                        <td className="message-cell">{status.message || '-'}</td>
                        <td>{formatDate(status.createdAt)}</td>
                        <td>{formatDate(status.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-data">
                <p>No automatic database backups found</p>
              </div>
            )}
          </div>
        )}

        {/* Files Tab */}
        {activeTab === 'files' && !loading && (
          <div className="status-table-container">
            <h2>Automatic Files Backups</h2>
            {statusData.length > 0 ? (
              <div className="table-wrapper">
                <table className="status-table">
                  <thead>
                    <tr>
                      <th>Job ID</th>
                      <th>Backend</th>
                      <th>Status</th>
                      <th>Progress</th>
                      <th>Message</th>
                      <th>Created At</th>
                      <th>Updated At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusData.map((status) => (
                      <tr key={status.jobId}>
                        <td className="job-id-cell">{status.jobId}</td>
                        <td>{status.backendName}</td>
                        <td>
                          <span className={`status-badge ${getStatusBadgeClass(status.status)}`}>
                            {status.status}
                          </span>
                        </td>
                        <td>{status.progress}%</td>
                        <td className="message-cell">{status.message || '-'}</td>
                        <td>{formatDate(status.createdAt)}</td>
                        <td>{formatDate(status.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-data">
                <p>No automatic files backups found</p>
              </div>
            )}
          </div>
        )}

        {/* No Tab Selected */}
        {!activeTab && (
          <div className="no-tab-selected">
            <p>👆 Please select a backup type above to view its status</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default AutoBackupStatus
