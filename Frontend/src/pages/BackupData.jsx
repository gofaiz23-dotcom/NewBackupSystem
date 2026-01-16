import { useState, useEffect } from 'react'
import { settingsAPI } from '../services/api'
import Message from '../components/Message/Message'
import DeleteBackupModal from '../components/Modal/DeleteBackupModal'
import ViewBackupRecordsModal from '../components/Modal/ViewBackupRecordsModal'
import DownloadExcelModal from '../components/Modal/DownloadExcelModal'
import './BackupData.css'

const BackupData = () => {
  const [backendNames, setBackendNames] = useState([])
  const [selectedBackend, setSelectedBackend] = useState(null)
  const [backupTables, setBackupTables] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showViewRecordsModal, setShowViewRecordsModal] = useState(false)
  const [showDownloadExcelModal, setShowDownloadExcelModal] = useState(false)
  const [deleteTableInfo, setDeleteTableInfo] = useState(null)
  const [viewRecordsTableInfo, setViewRecordsTableInfo] = useState(null)

  useEffect(() => {
    fetchBackendNames()
  }, [])

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

  const handleDeleteClick = (tableName, originalTableName) => {
    setDeleteTableInfo({
      backendName: selectedBackend,
      tableName: tableName,
      originalTableName: originalTableName
    })
    setShowDeleteModal(true)
  }

  const handleDeleteSuccess = () => {
    setShowDeleteModal(false)
    setDeleteTableInfo(null)
    // Refresh the backup tables list
    if (selectedBackend) {
      handleBackendSelect(selectedBackend)
    }
  }

  const handleViewRecordsClick = (tableName, originalTableName) => {
    setViewRecordsTableInfo({
      tableName: tableName,
      originalTableName: originalTableName
    })
    setShowViewRecordsModal(true)
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

  return (
    <div className="backup-data-page">
      <div className="page-header">
        <h1>Backup Data</h1>
      </div>

      {message.text && (
        <Message
          type={message.type}
          message={message.text}
          onClose={() => setMessage({ type: '', text: '' })}
        />
      )}

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
            <div>
              <h2>Backup Tables: {backupTables.backendName}</h2>
              <span className="tables-count">Total Tables: {backupTables.totalTables}</span>
            </div>
            <button
              className="download-excel-btn"
              onClick={() => setShowDownloadExcelModal(true)}
              title="Download table data as Excel"
            >
              📥 Download Excel
            </button>
          </div>

          {backupTables.totalTables > 0 ? (
            <div className="tables-table-container">
              <table className="backup-tables-table">
                <thead>
                  <tr>
                    <th>Table Name</th>
                    <th>Record Count</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getTableRows().map((row, index) => (
                    <tr key={index}>
                      <td className="table-name-cell">{row.tableName}</td>
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

      {showDownloadExcelModal && selectedBackend && backupTables && (
        <DownloadExcelModal
          backendName={selectedBackend}
          tables={backupTables}
          onClose={() => setShowDownloadExcelModal(false)}
        />
      )}
    </div>
  )
}

export default BackupData
