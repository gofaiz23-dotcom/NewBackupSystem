import { useState, useEffect } from 'react'
import { settingsAPI } from '../services/api'
import Message from '../components/Message/Message'
import './UploadLocalRemote.css'

const UploadLocalRemote = () => {
  const [activeTab, setActiveTab] = useState('upload') // 'upload' or 'status'
  const [backendNames, setBackendNames] = useState([])
  const [selectedBackend, setSelectedBackend] = useState(null)
  
  // Upload form state
  const [uploadType, setUploadType] = useState('database') // 'database' or 'files'
  const [selectedTable, setSelectedTable] = useState('')
  const [availableTables, setAvailableTables] = useState([])
  const [uploadLoading, setUploadLoading] = useState(false)
  
  // Status state
  const [uploadStatuses, setUploadStatuses] = useState([])
  const [statusLoading, setStatusLoading] = useState(false)
  
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    fetchBackendNames()
  }, [])

  useEffect(() => {
    if (selectedBackend && activeTab === 'status') {
      fetchUploadStatuses()
      // Auto-refresh every 5 seconds
      const interval = setInterval(fetchUploadStatuses, 5000)
      return () => clearInterval(interval)
    }
  }, [selectedBackend, activeTab])

  useEffect(() => {
    if (selectedBackend && uploadType === 'database') {
      fetchBackupTables()
    } else {
      setAvailableTables([])
      setSelectedTable('')
    }
  }, [selectedBackend, uploadType])

  const fetchBackendNames = async () => {
    try {
      // Fetch from settings API (settings table)
      const response = await settingsAPI.getAll()
      // Axios returns data in response.data, check if success property exists
      const data = response.data || response
      if (data.success) {
        setBackendNames(data.data || [])
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to fetch backend names from settings' })
        setBackendNames([])
      }
    } catch (error) {
      console.error('Error fetching backend names:', error)
      setMessage({ type: 'error', text: 'Failed to fetch backend names from settings table' })
      setBackendNames([])
    }
  }

  const fetchBackupTables = async () => {
    if (!selectedBackend) return

    try {
      // Fetch backup tables from backup database (backup tables)
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/backup/${selectedBackend}?tableName=all`
      )
      const data = await response.json()

      if (data.success && data.tables) {
        // Get ALL tables from backup database (tables starting with backup_)
        // Show all tables regardless of count or internal status
        const tables = Object.entries(data.tables)
          .filter(([tableName, tableInfo]) => {
            // Filter only tables that start with backup_
            return tableName.toLowerCase().startsWith('backup_')
          })
          .map(([tableName, tableInfo]) => {
            // Remove backup_ prefix for display, but keep original for API call
            const tableNameWithoutPrefix = tableName.replace(/^backup_/i, '')
            return {
              name: tableNameWithoutPrefix, // Display name without backup_ prefix
              originalName: tableName, // Full backup table name (backup_tableName)
              backupTableName: tableName, // Backup table name with prefix (for fetching from backup DB)
              remoteTableName: tableNameWithoutPrefix, // Remote table name without prefix (for uploading to remote)
              count: tableInfo.count || 0,
              hasError: !!tableInfo.error,
              error: tableInfo.error || null
            }
          })
        setAvailableTables(tables)
        if (tables.length === 0) {
          setMessage({ type: 'info', text: 'No backup tables found for this backend' })
        } else {
          setMessage({ type: 'success', text: `Found ${tables.length} backup table(s)` })
        }
      } else {
        setAvailableTables([])
        if (!data.success) {
          setMessage({ type: 'error', text: data.message || 'Failed to fetch backup tables from backup database' })
        }
      }
    } catch (error) {
      console.error('Error fetching backup tables:', error)
      setMessage({ type: 'error', text: 'Failed to fetch backup tables from backup database' })
      setAvailableTables([])
    }
  }

  const fetchUploadStatuses = async () => {
    if (!selectedBackend) return

    try {
      setStatusLoading(true)
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/upload/status/${selectedBackend}`
      )
      const data = await response.json()

      if (data.success) {
        setUploadStatuses(data.data || [])
        setMessage({ type: '', text: '' })
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to fetch upload statuses' })
        setUploadStatuses([])
      }
    } catch (error) {
      console.error('Error fetching upload statuses:', error)
      setMessage({ type: 'error', text: 'Failed to fetch upload statuses' })
      setUploadStatuses([])
    } finally {
      setStatusLoading(false)
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()

    if (!selectedBackend) {
      setMessage({ type: 'error', text: 'Please select a backend' })
      return
    }

    if (uploadType === 'database' && !selectedTable) {
      setMessage({ type: 'error', text: 'Please select a table' })
      return
    }

    try {
      setUploadLoading(true)
      setMessage({ type: '', text: '' })

      const body = {
        type: uploadType,
        backendName: selectedBackend
      }

      if (uploadType === 'database') {
        // Send the backup table name (with backup_ prefix) to backend
        // Backend will handle removing the prefix when uploading to remote
        const selectedTableInfo = availableTables.find(t => t.name === selectedTable)
        body.tableName = selectedTableInfo ? selectedTableInfo.backupTableName : selectedTable
      }

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: `Upload started successfully! Job ID: ${data.jobId}` })
        // Reset form
        setSelectedTable('')
        // Switch to status tab to see the upload progress
        setTimeout(() => {
          setActiveTab('status')
          fetchUploadStatuses()
        }, 1000)
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to start upload' })
      }
    } catch (error) {
      console.error('Error starting upload:', error)
      setMessage({ type: 'error', text: 'Failed to start upload' })
    } finally {
      setUploadLoading(false)
    }
  }

  const handleDeleteStatus = async (id) => {
    if (!window.confirm('Are you sure you want to delete this upload status?')) {
      return
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/upload/status/${id}`,
        {
          method: 'DELETE'
        }
      )

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Upload status deleted successfully' })
        fetchUploadStatuses()
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to delete upload status' })
      }
    } catch (error) {
      console.error('Error deleting upload status:', error)
      setMessage({ type: 'error', text: 'Failed to delete upload status' })
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
    <div className="upload-local-remote-page">
      <div className="page-header">
        <h1>📤 Upload Local to Remote</h1>
      </div>

      {message.text && (
        <Message
          type={message.type}
          message={message.text}
          onClose={() => setMessage({ type: '', text: '' })}
        />
      )}

      {/* Backend Selection */}
      <div className="backend-selection">
        <label htmlFor="backend-select">Select Backend:</label>
        <select
          id="backend-select"
          value={selectedBackend || ''}
          onChange={(e) => setSelectedBackend(e.target.value)}
          className="backend-select"
        >
          <option value="">-- Select a backend --</option>
          {backendNames.map((backend) => (
            <option key={backend.id} value={backend.backendname}>
              {backend.backendname}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <button
          className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          📤 Upload
        </button>
        <button
          className={`tab-btn ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => setActiveTab('status')}
          disabled={!selectedBackend}
        >
          📊 Status
        </button>
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="upload-tab">
          <div className="upload-form-container">
            <h2>Upload Data from Local to Remote</h2>
            <form onSubmit={handleUpload} className="upload-form">
              <div className="form-group">
                <label htmlFor="upload-type">Upload Type:</label>
                <select
                  id="upload-type"
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="form-select"
                  disabled={uploadLoading}
                >
                  <option value="database">Database Table</option>
                  <option value="files">Files</option>
                </select>
              </div>

              {uploadType === 'database' && (
                <div className="form-group">
                  <label htmlFor="table-select">Select Table:</label>
                  <select
                    id="table-select"
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    className="form-select"
                    disabled={uploadLoading || !selectedBackend || availableTables.length === 0}
                    required
                  >
                    <option value="">-- Select a table --</option>
                    {availableTables.map((table) => (
                      <option key={table.backupTableName} value={table.name}>
                        {table.name} ({table.count} records){table.hasError ? ' ⚠️ Error' : ''} → Remote: {table.remoteTableName}
                      </option>
                    ))}
                  </select>
                  {selectedBackend && availableTables.length === 0 && (
                    <p className="form-help">No backup tables found for this backend</p>
                  )}
                </div>
              )}

              {uploadType === 'files' && (
                <div className="form-group">
                  <p className="form-info">
                    This will upload all files from local backup directory to remote bucket.
                  </p>
                </div>
              )}

              <button
                type="submit"
                className="upload-btn"
                disabled={uploadLoading || !selectedBackend || (uploadType === 'database' && !selectedTable)}
              >
                {uploadLoading ? 'Starting Upload...' : '🚀 Start Upload'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Status Tab */}
      {activeTab === 'status' && (
        <div className="status-tab">
          {!selectedBackend ? (
            <div className="no-backend-selected">
              <p>Please select a backend to view upload statuses</p>
            </div>
          ) : statusLoading && uploadStatuses.length === 0 ? (
            <div className="loading-container">
              <div className="loading">Loading upload statuses...</div>
            </div>
          ) : uploadStatuses.length > 0 ? (
            <div className="status-table-container">
              <h2>Upload Statuses: {selectedBackend}</h2>
              <div className="table-wrapper">
                <table className="status-table">
                  <thead>
                    <tr>
                      <th>Job ID</th>
                      <th>Type</th>
                      <th>Table Name</th>
                      <th>Status</th>
                      <th>Progress</th>
                      <th>Message</th>
                      <th>Result</th>
                      <th>Created At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadStatuses.map((status) => (
                      <tr key={status.id}>
                        <td className="job-id-cell">{status.jobId}</td>
                        <td>
                          <span className={`type-badge ${status.type}`}>
                            {status.type}
                          </span>
                        </td>
                        <td>{status.tableName || '-'}</td>
                        <td>
                          <span className={`status-badge ${getStatusBadgeClass(status.status)}`}>
                            {status.status}
                          </span>
                        </td>
                        <td>{status.progress}%</td>
                        <td className="message-cell">{status.message || '-'}</td>
                        <td className="result-cell">
                          {status.result ? (
                            <details>
                              <summary>View Details</summary>
                              <pre>{JSON.stringify(status.result, null, 2)}</pre>
                            </details>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>{formatDate(status.createdAt)}</td>
                        <td>
                          <button
                            className="delete-btn"
                            onClick={() => handleDeleteStatus(status.id)}
                            title="Delete status"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="no-statuses">
              <p>No upload statuses found for this backend</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default UploadLocalRemote
