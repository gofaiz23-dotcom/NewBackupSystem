import { useState, useEffect } from 'react'
import Message from '../Message/Message'
import './Modal.css'
import './CreateBackupModal.css'

const CreateBackupModal = ({ backendNames, onClose, onSuccess }) => {
  const [selectedBackend, setSelectedBackend] = useState('')
  const [backupType, setBackupType] = useState('database') // 'files' or 'database'
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [jobId, setJobId] = useState(null)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (jobId) {
      // Poll for status updates
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/backup/status/${jobId}`)
          const data = await response.json()

          if (data.success) {
            setStatus(data)

            if (data.status === 'completed' || data.status === 'failed') {
              clearInterval(interval)
              if (data.status === 'completed') {
                setTimeout(() => {
                  onSuccess()
                }, 2000)
              }
            }
          }
        } catch (error) {
          console.error('Error checking status:', error)
        }
      }, 2000) // Poll every 2 seconds

      return () => clearInterval(interval)
    }
  }, [jobId, onSuccess])

  const handleCreateBackup = async () => {
    if (!selectedBackend) {
      setMessage({ type: 'error', text: 'Please select a backend' })
      return
    }

    try {
      setLoading(true)
      setMessage({ type: '', text: '' })

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/backup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: backupType,
          backendName: selectedBackend
        })
      })

      const data = await response.json()

      if (data.success) {
        setJobId(data.jobId)
        setStatus({
          status: 'processing',
          progress: 0,
          message: 'Backup process started...'
        })
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to start backup' })
        setLoading(false)
      }
    } catch (error) {
      console.error('Error creating backup:', error)
      setMessage({ type: 'error', text: 'Failed to start backup' })
      setLoading(false)
    }
  }

  const getStatusColor = () => {
    if (!status) return '#3498db'
    if (status.status === 'completed') return '#27ae60'
    if (status.status === 'failed') return '#e74c3c'
    return '#3498db'
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content create-backup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Backup</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {message.text && !jobId && (
          <Message
            type={message.type}
            message={message.text}
            onClose={() => setMessage({ type: '', text: '' })}
          />
        )}

        <div className="modal-body">
          {!jobId ? (
            <>
              <div className="form-group">
                <label>Backend Name *</label>
                <select
                  value={selectedBackend}
                  onChange={(e) => setSelectedBackend(e.target.value)}
                  className="form-select"
                  disabled={loading}
                >
                  <option value="">Select Backend</option>
                  {backendNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Backup Type *</label>
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="backupType"
                      value="database"
                      checked={backupType === 'database'}
                      onChange={(e) => setBackupType(e.target.value)}
                      disabled={loading}
                    />
                    <span>Database</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="backupType"
                      value="files"
                      checked={backupType === 'files'}
                      onChange={(e) => setBackupType(e.target.value)}
                      disabled={loading}
                    />
                    <span>Files</span>
                  </label>
                </div>
              </div>

              <div className="info-box">
                <strong>ℹ️ Info:</strong> The backup process will run in the background. You can close this modal and check the status later.
              </div>
            </>
          ) : (
            <div className="status-container">
              <div className="status-header">
                <h3>Backup Status</h3>
                <span className="status-badge" style={{ backgroundColor: getStatusColor() }}>
                  {status?.status || 'Processing'}
                </span>
              </div>

              {status && (
                <>
                  <div className="progress-container">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ 
                          width: `${status.progress || 0}%`,
                          backgroundColor: getStatusColor()
                        }}
                      />
                    </div>
                    <span className="progress-text">{status.progress || 0}%</span>
                  </div>

                  <div className="status-message">
                    {status.message || 'Processing...'}
                  </div>

                  {status.status === 'completed' && status.result && (
                    <div className="result-summary">
                      <h4>Backup Summary:</h4>
                      <div className="result-details">
                        {status.result.type === 'database' ? (
                          <>
                            <p><strong>Type:</strong> Database</p>
                            <p><strong>Tables Processed:</strong> {status.result.processedTables || 0} / {status.result.totalTables || 0}</p>
                            <p><strong>Records Inserted:</strong> {status.result.insertedRecords || 0}</p>
                            <p><strong>Records Updated:</strong> {status.result.updatedRecords || 0}</p>
                          </>
                        ) : (
                          <>
                            <p><strong>Type:</strong> Files</p>
                            <p><strong>Total Files:</strong> {status.result.totalFiles || 0}</p>
                            <p><strong>Downloaded:</strong> {status.result.downloadedFiles || 0}</p>
                            <p><strong>Skipped:</strong> {status.result.skippedFiles || 0}</p>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {status.status === 'failed' && status.error && (
                    <div className="error-summary">
                      <p><strong>Error:</strong> {status.error}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {!jobId ? (
            <>
              <button
                className="btn btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateBackup}
                disabled={loading || !selectedBackend}
              >
                {loading ? 'Starting...' : 'Start Backup'}
              </button>
            </>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={onClose}
              disabled={status?.status === 'processing'}
            >
              {status?.status === 'processing' ? 'Processing...' : 'Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default CreateBackupModal
