import { useState, useEffect } from 'react'
import { settingsAPI } from '../services/api'
import Message from '../components/Message/Message'
import './Comparison.css'

const Comparison = () => {
  const [activeTab, setActiveTab] = useState('tables') // 'tables' or 'files'
  const [backendNames, setBackendNames] = useState([])
  const [selectedBackend, setSelectedBackend] = useState(null)
  const [comparisonData, setComparisonData] = useState(null)
  const [filesComparisonData, setFilesComparisonData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filesLoading, setFilesLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [expandedTables, setExpandedTables] = useState(new Set())

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
      setExpandedTables(new Set())

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/comparison/${backendName}`)
      const data = await response.json()

      if (data.success) {
        setComparisonData(data)
        setMessage({ type: 'success', text: `Comparison completed for ${backendName}` })
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to fetch comparison data' })
        setComparisonData(null)
      }
    } catch (error) {
      console.error('Error fetching comparison:', error)
      setMessage({ type: 'error', text: 'Failed to fetch comparison data' })
      setComparisonData(null)
    } finally {
      setLoading(false)
    }
  }

  const handleFilesComparison = async (backendName) => {
    try {
      setFilesLoading(true)
      setSelectedBackend(backendName)
      setMessage({ type: '', text: '' })

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/backup/files/comparison/${backendName}`)
      const data = await response.json()

      if (data.success) {
        setFilesComparisonData(data.data)
        setMessage({ type: 'success', text: `Files comparison completed for ${backendName}` })
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to fetch files comparison' })
        setFilesComparisonData(null)
      }
    } catch (error) {
      console.error('Error fetching files comparison:', error)
      setMessage({ type: 'error', text: 'Failed to fetch files comparison' })
      setFilesComparisonData(null)
    } finally {
      setFilesLoading(false)
    }
  }

  const toggleTableExpansion = (tableName) => {
    const newExpanded = new Set(expandedTables)
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName)
    } else {
      newExpanded.add(tableName)
    }
    setExpandedTables(newExpanded)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'fully_backed_up':
        return '#27ae60'
      case 'partially_backed_up':
        return '#f39c12'
      case 'not_backed_up':
        return '#e74c3c'
      case 'error':
        return '#95a5a6'
      default:
        return '#95a5a6'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'fully_backed_up':
        return 'Fully Backed Up'
      case 'partially_backed_up':
        return 'Partially Backed Up'
      case 'not_backed_up':
        return 'Not Backed Up'
      case 'error':
        return 'Error'
      default:
        return status
    }
  }

  return (
    <div className="comparison-page">
      <div className="page-header">
        <h1>Backup Comparison</h1>
        <p className="page-subtitle">Compare backup tables with remote database tables</p>
        <div className="info-note">
          <span className="info-icon">ℹ️</span>
          <span>Internal system tables (settings, backup_statuses) are excluded from comparison</span>
        </div>
      </div>

      {message.text && (
        <Message
          type={message.type}
          message={message.text}
          onClose={() => setMessage({ type: '', text: '' })}
        />
      )}

      <div className="tabs-container">
        <button
          className={`tab-btn ${activeTab === 'tables' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('tables')
            if (selectedBackend) {
              handleBackendSelect(selectedBackend)
            }
          }}
        >
          Tables
        </button>
        <button
          className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('files')
            if (selectedBackend) {
              handleFilesComparison(selectedBackend)
            }
          }}
        >
          Files
        </button>
      </div>

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
                onClick={() => {
                  if (activeTab === 'tables') {
                    handleBackendSelect(name)
                  } else {
                    handleFilesComparison(name)
                  }
                }}
                disabled={loading || filesLoading}
              >
                {name}
              </button>
            ))
          )}
        </div>
      </div>

      {loading && activeTab === 'tables' && (
        <div className="loading-container">
          <div className="loading">Comparing backup with remote database...</div>
        </div>
      )}

      {filesLoading && activeTab === 'files' && (
        <div className="loading-container">
          <div className="loading">Comparing files between bucket and local backup...</div>
        </div>
      )}

      {/* Tables Comparison */}
      {activeTab === 'tables' && comparisonData && !loading && (
        <div className="comparison-container">
          {/* Summary Section */}
          <div className="summary-section">
            <h2>Summary</h2>
              <div className="summary-cards">
              <div className="summary-card">
                <div className="summary-card-label">Total Remote Tables</div>
                <div className="summary-card-value">{comparisonData.totalRemoteTables ?? 0}</div>
              </div>
              <div className="summary-card">
                <div className="summary-card-label">Total Backup Tables</div>
                <div className="summary-card-value">{comparisonData.totalBackupTables ?? 0}</div>
              </div>
              <div className="summary-card success">
                <div className="summary-card-label">Fully Backed Up</div>
                <div className="summary-card-value">{comparisonData.summary?.fullyBackedUp ?? 0}</div>
              </div>
              <div className="summary-card warning">
                <div className="summary-card-label">Partially Backed Up</div>
                <div className="summary-card-value">{comparisonData.summary?.partiallyBackedUp ?? 0}</div>
              </div>
              <div className="summary-card error">
                <div className="summary-card-label">Not Backed Up</div>
                <div className="summary-card-value">{comparisonData.summary?.notBackedUp ?? 0}</div>
              </div>
              <div className="summary-card info">
                <div className="summary-card-label">Missing in Remote</div>
                <div className="summary-card-value">{comparisonData.summary?.missingInRemote ?? 0}</div>
              </div>
            </div>
          </div>

          {/* Tables Comparison Section */}
          <div className="tables-comparison-section">
            <h2>Tables Comparison</h2>
            <div className="tables-comparison-table-container">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Table Name</th>
                    <th>Backup Table</th>
                    <th>Remote Count</th>
                    <th>Backup Count</th>
                    <th>Difference</th>
                    <th>Progress</th>
                    <th>Status</th>
                    <th>Missing Records</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(comparisonData.tablesComparison || []).map((table, index) => (
                    <>
                      <tr key={index} className={`table-row ${table.status}`}>
                        <td className="table-name-cell">{table.tableName || '-'}</td>
                        <td>
                          {table.backupTableName ? (
                            <span className="backup-table-name">{table.backupTableName}</span>
                          ) : (
                            <span className="missing-badge">Not in Backup</span>
                          )}
                        </td>
                        <td className="count-cell">{(table.remoteCount ?? 0).toLocaleString()}</td>
                        <td className="count-cell">{(table.backupCount ?? 0).toLocaleString()}</td>
                        <td className={`difference-cell ${(table.difference ?? 0) > 0 ? 'negative' : (table.difference ?? 0) < 0 ? 'positive' : ''}`}>
                          {(table.difference ?? 0) > 0 ? '+' : ''}{(table.difference ?? 0).toLocaleString()}
                        </td>
                        <td>
                          <div className="progress-container">
                            <div className="progress-bar">
                              <div 
                                className="progress-fill" 
                                style={{ 
                                  width: `${table.progress ?? 0}%`,
                                  backgroundColor: getStatusColor(table.status)
                                }}
                              />
                            </div>
                            <span className="progress-text">{table.progress ?? 0}%</span>
                          </div>
                        </td>
                        <td>
                          <span 
                            className="status-badge"
                            style={{ backgroundColor: getStatusColor(table.status) }}
                          >
                            {getStatusLabel(table.status)}
                          </span>
                        </td>
                        <td>
                          {(table.missingRecordsCount ?? 0) > 0 ? (
                            <span className="missing-records-badge">
                              {table.missingRecordsCount} missing
                            </span>
                          ) : (
                            <span className="no-missing">-</span>
                          )}
                        </td>
                        <td>
                          {(table.missingRecordsCount ?? 0) > 0 && table.missingRecords && table.missingRecords.length > 0 && (
                            <button
                              className="expand-btn"
                              onClick={() => toggleTableExpansion(table.tableName)}
                            >
                              {expandedTables.has(table.tableName) ? '▼ Hide' : '▶ Show'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedTables.has(table.tableName) && table.missingRecords && table.missingRecords.length > 0 && (
                        <tr key={`${index}-details`} className="details-row">
                          <td colSpan="9" className="details-cell">
                            <div className="missing-records-details">
                              <h4>Missing Records ({(table.missingRecordsCount ?? 0)} total, showing first {table.missingRecords.length}):</h4>
                              <div className="missing-records-table-container">
                                <table className="missing-records-table">
                                  <thead>
                                    <tr>
                                      {Object.keys(table.missingRecords[0] || {}).map((key) => (
                                        <th key={key}>{key}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {table.missingRecords.map((record, recordIdx) => (
                                      <tr key={recordIdx}>
                                        {Object.entries(record).map(([key, value]) => (
                                          <td key={key} className="missing-record-cell">
                                            {value === null || value === undefined 
                                              ? <span className="null-value">NULL</span>
                                              : typeof value === 'object'
                                              ? JSON.stringify(value)
                                              : String(value)
                                            }
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              {(table.missingRecordsCount ?? 0) > (table.missingRecords?.length ?? 0) && (
                                <div className="more-records-info">
                                  <span className="more-records">
                                    ... and {(table.missingRecordsCount ?? 0) - (table.missingRecords?.length ?? 0)} more records not shown
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Missing in Backup Section */}
          {(comparisonData.missingInBackup || []).length > 0 && (
            <div className="missing-section missing-in-backup">
              <h2>Tables Missing in Backup ({(comparisonData.missingInBackup || []).length})</h2>
              <div className="missing-tables-list">
                {(comparisonData.missingInBackup || []).map((table, index) => (
                  <div key={index} className="missing-table-card">
                    <div className="missing-table-name">{table.tableName || '-'}</div>
                    <div className="missing-table-info">
                      <span>Remote Count: <strong>{(table.remoteCount ?? 0).toLocaleString()}</strong></span>
                      <span>Backup Count: <strong>0</strong></span>
                      <span>Progress: <strong>0%</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing in Remote Section */}
          {(comparisonData.missingInRemote || []).length > 0 && (
            <div className="missing-section missing-in-remote">
              <h2>Tables Missing in Remote ({(comparisonData.missingInRemote || []).length})</h2>
              <div className="missing-tables-list">
                {(comparisonData.missingInRemote || []).map((table, index) => (
                  <div key={index} className="missing-table-card">
                    <div className="missing-table-name">{table.backupTableName || table.tableName || '-'}</div>
                    <div className="missing-table-info">
                      <span>Backup Count: <strong>{(table.backupCount ?? 0).toLocaleString()}</strong></span>
                      <span>Remote Count: <strong>0</strong></span>
                      <span className="warning-text">⚠️ This table exists only in backup</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Files Comparison */}
      {activeTab === 'files' && filesComparisonData && !filesLoading && (
        <div className="files-comparison-container">
          <div className="files-summary-section">
            <h2>Files Comparison: {filesComparisonData.backendName}</h2>
            <div className="summary-cards">
              <div className="summary-card">
                <div className="summary-card-label">Total Bucket Files</div>
                <div className="summary-card-value">{filesComparisonData.summary?.totalBucketFiles || 0}</div>
              </div>
              <div className="summary-card">
                <div className="summary-card-label">Total Local Files</div>
                <div className="summary-card-value">{filesComparisonData.summary?.totalLocalFiles || 0}</div>
              </div>
              <div className="summary-card success">
                <div className="summary-card-label">Matching Files</div>
                <div className="summary-card-value">{filesComparisonData.summary?.matchingFiles || 0}</div>
              </div>
              <div className="summary-card error">
                <div className="summary-card-label">Missing in Local</div>
                <div className="summary-card-value">{filesComparisonData.summary?.missingInLocal || 0}</div>
              </div>
              <div className="summary-card warning">
                <div className="summary-card-label">Missing in Bucket</div>
                <div className="summary-card-value">{filesComparisonData.summary?.missingInBucket || 0}</div>
              </div>
              <div className="summary-card info">
                <div className="summary-card-label">Different Files</div>
                <div className="summary-card-value">{filesComparisonData.summary?.differentFiles || 0}</div>
              </div>
            </div>
          </div>

          {/* Missing in Local Section */}
          {(filesComparisonData.missingInLocal || []).length > 0 && (
            <div className="missing-section missing-in-local">
              <h3>Files Missing in Local Backup ({(filesComparisonData.missingInLocal || []).length})</h3>
              <div className="files-list-container">
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th>File Name</th>
                      <th>Path</th>
                      <th>Size</th>
                      <th>Last Modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filesComparisonData.missingInLocal || []).map((file, index) => (
                      <tr key={index}>
                        <td>{file.name}</td>
                        <td className="file-path-cell">{file.key}</td>
                        <td>{formatBytes(file.size || 0)}</td>
                        <td>{file.lastModified ? new Date(file.lastModified).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Missing in Bucket Section */}
          {(filesComparisonData.missingInBucket || []).length > 0 && (
            <div className="missing-section missing-in-bucket">
              <h3>Files Missing in Bucket ({(filesComparisonData.missingInBucket || []).length})</h3>
              <div className="files-list-container">
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th>File Name</th>
                      <th>Path</th>
                      <th>Size</th>
                      <th>Last Modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filesComparisonData.missingInBucket || []).map((file, index) => (
                      <tr key={index}>
                        <td>{file.name}</td>
                        <td className="file-path-cell">{file.key}</td>
                        <td>{formatBytes(file.size || 0)}</td>
                        <td>{file.lastModified ? new Date(file.lastModified).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Different Files Section */}
          {(filesComparisonData.differentFiles || []).length > 0 && (
            <div className="missing-section different-files">
              <h3>Files with Different Sizes ({(filesComparisonData.differentFiles || []).length})</h3>
              <div className="files-list-container">
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th>File Name</th>
                      <th>Path</th>
                      <th>Bucket Size</th>
                      <th>Local Size</th>
                      <th>Bucket Last Modified</th>
                      <th>Local Last Modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filesComparisonData.differentFiles || []).map((file, index) => (
                      <tr key={index}>
                        <td>{file.name}</td>
                        <td className="file-path-cell">{file.key}</td>
                        <td>{formatBytes(file.bucketSize || 0)}</td>
                        <td>{formatBytes(file.localSize || 0)}</td>
                        <td>{file.bucketLastModified ? new Date(file.bucketLastModified).toLocaleString() : '-'}</td>
                        <td>{file.localLastModified ? new Date(file.localLastModified).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

export default Comparison
