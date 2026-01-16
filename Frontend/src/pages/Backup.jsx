import { useState, useEffect } from 'react'
import { settingsAPI } from '../services/api'
import Message from '../components/Message/Message'
import DeleteBackupModal from '../components/Modal/DeleteBackupModal'
import CreateBackupModal from '../components/Modal/CreateBackupModal'
import ViewBackupRecordsModal from '../components/Modal/ViewBackupRecordsModal'
import './Backup.css'

const Backup = () => {
  const [activeTab, setActiveTab] = useState('tables') // 'tables', 'files', or 'statuses'
  const [backendNames, setBackendNames] = useState([])
  const [selectedBackend, setSelectedBackend] = useState(null)
  const [backupTables, setBackupTables] = useState(null)
  const [backupFiles, setBackupFiles] = useState(null)
  const [backupStatuses, setBackupStatuses] = useState([])
  const [loading, setLoading] = useState(false)
  const [filesLoading, setFilesLoading] = useState(false)
  const [statusesLoading, setStatusesLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showViewRecordsModal, setShowViewRecordsModal] = useState(false)
  const [deleteTableInfo, setDeleteTableInfo] = useState(null)
  const [viewRecordsTableInfo, setViewRecordsTableInfo] = useState(null)
  const [deletingStatusId, setDeletingStatusId] = useState(null)

  useEffect(() => {
    fetchBackendNames()
    fetchAllStatuses()
  }, [])

  // Auto-refresh statuses every 5 seconds when on statuses tab
  useEffect(() => {
    if (activeTab === 'statuses') {
      fetchAllStatuses()
      const interval = setInterval(() => {
        fetchAllStatuses()
      }, 5000) // Refresh every 5 seconds

      return () => clearInterval(interval)
    }
  }, [activeTab])

  // Auto-close message after 5 seconds
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => {
        setMessage({ type: '', text: '' })
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [message.text])

  const fetchBackendNames = async () => {
    try {
      const response = await settingsAPI.getAll()
      const settings = response.data.data || []
      const names = settings.map(setting => setting.backendname)
      setBackendNames(names)
      
      if (names.length === 0) {
        setMessage({ type: 'info', text: 'No backend names found. Please add settings first.' })
      }
    } catch (error) {
      console.error('Error fetching backend names:', error)
      setMessage({ type: 'error', text: 'Failed to fetch backend names' })
    }
  }

  const handleBackendSelect = async (backendName) => {
    try {
      setLoading(true)
      setSelectedBackend(backendName)
      setMessage({ type: '', text: '' })

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/backup/${backendName}`)
      const data = await response.json()

      if (data.success) {
        setBackupTables(data)
        setMessage({ type: 'success', text: `Successfully fetched backup tables from ${backendName}` })
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to fetch backup tables' })
        setBackupTables(null)
      }
    } catch (error) {
      console.error('Error fetching backup tables:', error)
      setMessage({ type: 'error', text: 'Failed to fetch backup tables' })
      setBackupTables(null)
    } finally {
      setLoading(false)
    }
  }

  const handleFilesSelect = async (backendName) => {
    try {
      setFilesLoading(true)
      setSelectedBackend(backendName)
      setMessage({ type: '', text: '' })

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/backup/files/${backendName}`)
      const data = await response.json()

      if (data.success) {
        setBackupFiles(data.data)
        setMessage({ type: 'success', text: `Successfully fetched backup files from ${backendName}` })
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to fetch backup files' })
        setBackupFiles(null)
      }
    } catch (error) {
      console.error('Error fetching backup files:', error)
      setMessage({ type: 'error', text: 'Failed to fetch backup files' })
      setBackupFiles(null)
    } finally {
      setFilesLoading(false)
    }
  }

  const handleDeleteClick = (tableName, originalTableName) => {
    setDeleteTableInfo({
      backendName: selectedBackend,
      tableName: tableName,
      originalTableName: originalTableName
    })
    setShowDeleteModal(true)
  }

  const handleViewRecordsClick = (tableName, originalTableName) => {
    setViewRecordsTableInfo({
      tableName: tableName,
      originalTableName: originalTableName
    })
    setShowViewRecordsModal(true)
  }

  const handleDeleteSuccess = () => {
    setShowDeleteModal(false)
    setDeleteTableInfo(null)
    // Refresh the backup tables list
    if (selectedBackend) {
      handleBackendSelect(selectedBackend)
    }
  }

  const fetchAllStatuses = async () => {
    try {
      setStatusesLoading(true)
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/backup/status?limit=100`)
      const data = await response.json()

      if (data.success) {
        setBackupStatuses(data.statuses || [])
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to fetch backup statuses' })
      }
    } catch (error) {
      console.error('Error fetching backup statuses:', error)
      setMessage({ type: 'error', text: 'Failed to fetch backup statuses' })
    } finally {
      setStatusesLoading(false)
    }
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    if (tab === 'statuses') {
      fetchAllStatuses()
    }
  }

  const handleDeleteStatus = async (jobId) => {
    if (!window.confirm(`Are you sure you want to delete backup status "${jobId}"? This action cannot be undone.`)) {
      return
    }

    try {
      setDeletingStatusId(jobId)
      setMessage({ type: '', text: '' })

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/backup/status/${jobId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Backup status deleted successfully' })
        await fetchAllStatuses()
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to delete backup status' })
      }
    } catch (error) {
      console.error('Error deleting backup status:', error)
      setMessage({ type: 'error', text: `Failed to delete backup status: ${error.message}` })
    } finally {
      setDeletingStatusId(null)
    }
  }

  const getStatusColor = (status) => {
    if (status === 'completed') return '#27ae60'
    if (status === 'failed') return '#e74c3c'
    if (status === 'processing') return '#3498db'
    return '#95a5a6'
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString()
  }

  const getTableRows = () => {
    if (!backupTables || !backupTables.tables) return []

    return Object.entries(backupTables.tables).map(([tableName, tableInfo]) => ({
      tableName,
      originalTableName: tableInfo.originalTableName || tableName.replace('backup_', ''),
      count: tableInfo.count || 0,
      error: tableInfo.error
    }))
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const renderFileStructure = (structure, level = 0) => {
    const items = []

    // Render files in current folder
    if (structure.files && structure.files.length > 0) {
      structure.files.forEach((file, index) => {
        items.push(
          <div key={`file-${index}`} className="file-item" style={{ paddingLeft: `${level * 20}px` }}>
            <span className="file-icon">📄</span>
            <span className="file-name">{file.name}</span>
            <span className="file-size">{formatBytes(file.size || 0)}</span>
          </div>
        )
      })
    }

    // Render subfolders
    if (structure.folders && Object.keys(structure.folders).length > 0) {
      Object.entries(structure.folders).forEach(([folderName, folder]) => {
        items.push(
          <div key={`folder-${folderName}`} className="folder-item" style={{ paddingLeft: `${level * 20}px` }}>
            <span className="folder-icon">📁</span>
            <span className="folder-name">{folderName}</span>
            <span className="folder-info">
              ({folder.totalFiles || 0} files, {formatBytes(folder.totalSize || 0)})
            </span>
          </div>
        )
        // Recursively render folder contents
        items.push(renderFileStructure(folder, level + 1))
      })
    }

    return items
  }

  return (
    <div className="backup-page">
      <div className="page-header">
        <h1>Backup Management</h1>
      </div>

      {message.text && (
        <Message
          type={message.type}
          message={message.text}
          onClose={() => setMessage({ type: '', text: '' })}
        />
      )}

      <div className="create-backup-section">
        <h3>Create New Backup</h3>
        <button
          className="create-backup-btn"
          onClick={() => setShowCreateModal(true)}
        >
          + Create Backup
        </button>
      </div>

      <div className="tabs-container">
        <button
          className={`tab-btn ${activeTab === 'tables' ? 'active' : ''}`}
          onClick={() => handleTabChange('tables')}
        >
          Backup Tables
        </button>
        <button
          className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => handleTabChange('files')}
        >
          Files
        </button>
        <button
          className={`tab-btn ${activeTab === 'statuses' ? 'active' : ''}`}
          onClick={() => handleTabChange('statuses')}
        >
          Backup Statuses
        </button>
      </div>

      {/* Backup Tables Tab */}
      {activeTab === 'tables' && (
        <>
          <div className="backend-buttons-container">
            <h3>Select Backend:</h3>
            <div className="backend-buttons">
              {backendNames.length === 0 ? (
                <p className="no-backends">No backend names available</p>
              ) : (
                backendNames.map((name) => (
                  <button
                    key={name}
                    className={`backend-btn ${selectedBackend === name ? 'active' : ''}`}
                    onClick={() => handleBackendSelect(name)}
                    disabled={loading}
                  >
                    {name}
                  </button>
                ))
              )}
            </div>
          </div>

          {loading && (
            <div className="loading-container">
              <div className="loading">Loading backup tables...</div>
            </div>
          )}

          {backupTables && !loading && (
            <div className="backup-tables-container">
              <div className="tables-header">
                <h2>Backup Tables: {backupTables.backendName}</h2>
                <span className="tables-count">Total Tables: {backupTables.totalTables}</span>
              </div>

              {backupTables.totalTables > 0 ? (
                <div className="tables-table-container">
                  <table className="backup-tables-table">
                    <thead>
                      <tr>
                        <th>Table Name</th>
                        <th>Original Table Name</th>
                        <th>Record Count</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getTableRows().map((row, index) => (
                        <tr key={index}>
                          <td className="table-name-cell">{row.tableName}</td>
                          <td>{row.originalTableName}</td>
                          <td>
                            {row.error ? (
                              <span className="error-badge">Error</span>
                            ) : (
                              <span className="count-badge">{row.count}</span>
                            )}
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button
                                className="view-btn"
                                onClick={() => handleViewRecordsClick(row.tableName, row.originalTableName)}
                                disabled={!!row.error || row.count === 0}
                                title="View records in this table"
                              >
                                👁️ View Records
                              </button>
                              <button
                                className="delete-btn"
                                onClick={() => handleDeleteClick(row.tableName, row.originalTableName)}
                                disabled={!!row.error}
                                title="Delete all records from this table"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="no-tables">
                  <p>No backup tables found for this backend</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Files Tab */}
      {activeTab === 'files' && (
        <>
          <div className="backend-buttons-container">
            <h3>Select Backend:</h3>
            <div className="backend-buttons">
              {backendNames.length === 0 ? (
                <p className="no-backends">No backend names available</p>
              ) : (
                backendNames.map((name) => (
                  <button
                    key={name}
                    className={`backend-btn ${selectedBackend === name ? 'active' : ''}`}
                    onClick={() => handleFilesSelect(name)}
                    disabled={filesLoading}
                  >
                    {name}
                  </button>
                ))
              )}
            </div>
          </div>

          {filesLoading && (
            <div className="loading-container">
              <div className="loading">Loading backup files...</div>
            </div>
          )}

          {backupFiles && !filesLoading && (
            <div className="backup-files-container">
              <div className="files-header">
                <h2>Backup Files: {selectedBackend}</h2>
                <div className="files-summary">
                  <span>Total Files: {backupFiles.totalFiles || 0}</span>
                  <span>Total Size: {formatBytes(backupFiles.totalSize || 0)}</span>
                </div>
              </div>

              {backupFiles.totalFiles > 0 ? (
                <div className="files-structure">
                  {renderFileStructure(backupFiles)}
                </div>
              ) : (
                <div className="no-files">
                  <p>No backup files found for this backend</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Backup Statuses Tab */}
      {activeTab === 'statuses' && (
        <div className="statuses-container">
          <div className="statuses-header">
            <h2>All Backup Statuses</h2>
            <button
              className="refresh-btn"
              onClick={fetchAllStatuses}
              disabled={statusesLoading}
            >
              {statusesLoading ? 'Refreshing...' : '🔄 Refresh'}
            </button>
          </div>

          {statusesLoading && backupStatuses.length === 0 ? (
            <div className="loading-container">
              <div className="loading">Loading statuses...</div>
            </div>
          ) : backupStatuses.length > 0 ? (
            <div className="statuses-table-container">
              <table className="statuses-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Backend</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Message</th>
                    <th>Created At</th>
                    <th>Updated At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backupStatuses.map((status) => (
                    <tr key={status.jobId}>
                      <td className="job-id-cell">{status.jobId}</td>
                      <td>{status.backendName}</td>
                      <td>
                        <span className="type-badge">{status.type}</span>
                      </td>
                      <td>
                        <span 
                          className="status-badge" 
                          style={{ backgroundColor: getStatusColor(status.status) }}
                        >
                          {status.status}
                        </span>
                      </td>
                      <td>
                        <div className="progress-cell">
                          <div className="progress-bar-small">
                            <div 
                              className="progress-fill-small" 
                              style={{ 
                                width: `${status.progress || 0}%`,
                                backgroundColor: getStatusColor(status.status)
                              }}
                            />
                          </div>
                          <span className="progress-text-small">{status.progress || 0}%</span>
                        </div>
                      </td>
                      <td className="message-cell">{status.message || '-'}</td>
                      <td className="date-cell">{formatDate(status.createdAt)}</td>
                      <td className="date-cell">{formatDate(status.updatedAt)}</td>
                      <td>
                        <button
                          className="delete-status-btn"
                          onClick={() => handleDeleteStatus(status.jobId)}
                          disabled={deletingStatusId === status.jobId}
                          title="Delete this backup status"
                        >
                          {deletingStatusId === status.jobId ? 'Deleting...' : '🗑️ Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-statuses">
              <p>No backup statuses found</p>
            </div>
          )}
        </div>
      )}

      {showDeleteModal && deleteTableInfo && (
        <DeleteBackupModal
          tableInfo={deleteTableInfo}
          backendNames={backendNames}
          onClose={() => {
            setShowDeleteModal(false)
            setDeleteTableInfo(null)
          }}
          onSuccess={handleDeleteSuccess}
        />
      )}

      {showCreateModal && (
        <CreateBackupModal
          backendNames={backendNames}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            // Refresh tables if a backend is selected
            if (selectedBackend) {
              handleBackendSelect(selectedBackend)
            }
            // Refresh statuses
            fetchAllStatuses()
            // Switch to statuses tab to see the new backup
            setActiveTab('statuses')
          }}
        />
      )}

      {showViewRecordsModal && viewRecordsTableInfo && selectedBackend && (
        <ViewBackupRecordsModal
          tableInfo={viewRecordsTableInfo}
          backendName={selectedBackend}
          onClose={() => {
            setShowViewRecordsModal(false)
            setViewRecordsTableInfo(null)
          }}
        />
      )}
    </div>
  )
}

export default Backup
