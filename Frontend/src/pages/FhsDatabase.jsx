import { useState, useEffect } from 'react'
import { settingsAPI } from '../services/api'
import Message from '../components/Message/Message'
import DownloadFhsDatabaseExcelModal from '../components/Modal/DownloadFhsDatabaseExcelModal'
import './FhsDatabase.css'

const FhsDatabase = () => {
  const [activeTab, setActiveTab] = useState(null) // 'database', 'files', or null
  const [backendNames, setBackendNames] = useState([])
  const [selectedBackend, setSelectedBackend] = useState(null)
  
  // Database state
  const [databaseData, setDatabaseData] = useState(null)
  const [selectedTable, setSelectedTable] = useState(null)
  const [tableData, setTableData] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 })
  const [showDatabaseUrl, setShowDatabaseUrl] = useState(false)
  
  // Files state
  const [filesData, setFilesData] = useState(null)
  const [showBucketUrl, setShowBucketUrl] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState(new Set())
  
  const [loading, setLoading] = useState(false)
  const [tableLoading, setTableLoading] = useState(false)
  const [filesLoading, setFilesLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [showDownloadExcelModal, setShowDownloadExcelModal] = useState(false)

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

  // Fetch table data when table is selected or page changes
  useEffect(() => {
    if (selectedBackend && selectedTable && activeTab === 'database') {
      fetchTableData(selectedTable, pagination.page, pagination.limit)
    }
  }, [selectedTable, pagination.page, pagination.limit, activeTab])

  // Fetch files when backend is selected and files tab is active
  useEffect(() => {
    if (selectedBackend && activeTab === 'files' && !filesData) {
      fetchFiles()
    }
  }, [selectedBackend, activeTab])

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
      setSelectedBackend(backendName)
      setSelectedTable(null)
      setTableData(null)
      setFilesData(null)
      setDatabaseData(null)
      setExpandedFolders(new Set())
      setActiveTab(null) // Reset tab selection when backend changes
      setMessage({ type: '', text: '' })
    } catch (error) {
      console.error('Error selecting backend:', error)
      setMessage({ type: 'error', text: 'Failed to select backend' })
    }
  }

  const fetchFiles = async () => {
    if (!selectedBackend) return

    try {
      setFilesLoading(true)
      setExpandedFolders(new Set())
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/getallFiles/${selectedBackend}`)
      const data = await response.json()

      if (data.success) {
        setFilesData(data)
        setMessage({ type: 'success', text: `Successfully fetched files from ${selectedBackend}` })
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to fetch files' })
        setFilesData(null)
      }
    } catch (error) {
      console.error('Error fetching files:', error)
      setMessage({ type: 'error', text: 'Failed to fetch files' })
      setFilesData(null)
    } finally {
      setFilesLoading(false)
    }
  }

  const fetchTableData = async (tableName, page = 1, limit = 10) => {
    if (!selectedBackend) return

    try {
      setTableLoading(true)
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/getallDatafromdb/${selectedBackend}/${tableName}?page=${page}&limit=${limit}`
      )
      const data = await response.json()

      if (data.success) {
        setTableData(data.data)
        setPagination({
          page: data.page,
          limit: data.limit,
          total: data.total,
          totalPages: data.totalPages
        })
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to fetch table data' })
        setTableData(null)
      }
    } catch (error) {
      console.error('Error fetching table data:', error)
      setMessage({ type: 'error', text: 'Failed to fetch table data' })
      setTableData(null)
    } finally {
      setTableLoading(false)
    }
  }

  const handleTableSelect = (tableName) => {
    setSelectedTable(tableName)
    setPagination({ page: 1, limit: 10, total: 0, totalPages: 0 })
    setTableData(null)
  }

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }))
    }
  }

  const handleLimitChange = (newLimit) => {
    setPagination(prev => ({ ...prev, limit: parseInt(newLimit), page: 1 }))
  }

  const handleTabChange = async (tab) => {
    // Don't allow tab change if no backend is selected
    if (!selectedBackend) {
      return
    }
    
    setActiveTab(tab)
    setSelectedTable(null)
    setTableData(null)
    setFilesData(null)
    setExpandedFolders(new Set())
    setMessage({ type: '', text: '' })

    // Fetch data based on selected tab
    if (tab === 'database') {
      try {
        setLoading(true)
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/getallDatafromdb/${selectedBackend}`)
        const data = await response.json()

        if (data.success) {
          setDatabaseData(data)
          setMessage({ type: 'success', text: `Successfully fetched data from ${selectedBackend}` })
        } else {
          setMessage({ type: 'error', text: data.message || 'Failed to fetch database data' })
          setDatabaseData(null)
        }
      } catch (error) {
        console.error('Error fetching database data:', error)
        setMessage({ type: 'error', text: 'Failed to fetch database data' })
        setDatabaseData(null)
      } finally {
        setLoading(false)
      }
    } else if (tab === 'files') {
      await fetchFiles()
    }
  }

  const getTableRowCount = (tableName) => {
    if (!databaseData || !databaseData.tables[tableName]) return 0
    const tableInfo = databaseData.tables[tableName]
    if (tableInfo.error) return 0
    return tableInfo.count || 0
  }

  const renderPagination = () => {
    if (!selectedTable || pagination.totalPages <= 1) return null

    const pages = []
    const maxVisiblePages = 5
    let startPage = Math.max(1, pagination.page - Math.floor(maxVisiblePages / 2))
    let endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1)

    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }

    return (
      <div className="pagination">
        <div className="pagination-info">
          <span>
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} records
          </span>
          <select
            value={pagination.limit}
            onChange={(e) => handleLimitChange(e.target.value)}
            className="limit-select"
          >
            <option value="10">10 per page</option>
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </select>
        </div>
        <div className="pagination-controls">
          <button
            className="pagination-btn"
            onClick={() => handlePageChange(1)}
            disabled={pagination.page === 1}
          >
            First
          </button>
          <button
            className="pagination-btn"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
          >
            Previous
          </button>
          {pages.map((pageNum) => (
            <button
              key={pageNum}
              className={`pagination-btn ${pagination.page === pageNum ? 'active' : ''}`}
              onClick={() => handlePageChange(pageNum)}
            >
              {pageNum}
            </button>
          ))}
          <button
            className="pagination-btn"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
          >
            Next
          </button>
          <button
            className="pagination-btn"
            onClick={() => handlePageChange(pagination.totalPages)}
            disabled={pagination.page === pagination.totalPages}
          >
            Last
          </button>
        </div>
      </div>
    )
  }

  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const toggleFolder = (folderPath) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath)
      } else {
        newSet.add(folderPath)
      }
      return newSet
    })
  }

  // Calculate total storage size for a folder (including subfolders)
  const calculateFolderSize = (folder) => {
    let totalSize = 0

    // Add size of files directly in this folder
    if (folder.files && folder.files.length > 0) {
      folder.files.forEach(file => {
        totalSize += file.size || 0
      })
    }

    // Recursively add size of subfolders
    if (folder.folders && Object.keys(folder.folders).length > 0) {
      Object.values(folder.folders).forEach(subFolder => {
        totalSize += calculateFolderSize(subFolder)
      })
    }

    return totalSize
  }

  const renderFolderStructure = (structure, path = '', level = 0) => {
    const folderPath = path ? `${path}/` : ''
    const hasContent = (structure.folders && Object.keys(structure.folders).length > 0) || 
                      (structure.files && structure.files.length > 0)

    if (!hasContent) return null

    return (
      <>
        {/* Render root level files */}
        {structure.files && structure.files.length > 0 && (
          <div className="files-list" style={{ marginLeft: `${level * 20}px` }}>
            {structure.files.map((file, index) => (
              <div key={index} className="file-item">
                <span className="file-icon">📄</span>
                <span className="file-name">{file.name}</span>
                <span className="file-size">{file.size ? formatFileSize(file.size) : '-'}</span>
                <span className="file-date">
                  {file.lastModified 
                    ? new Date(file.lastModified).toLocaleString()
                    : '-'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Render folders */}
        {structure.folders && Object.keys(structure.folders).map((folderName) => {
          const currentPath = folderPath + folderName
          const isExpanded = expandedFolders.has(currentPath)
          const folder = structure.folders[folderName]
          const folderFileCount = folder.files ? folder.files.length : 0
          const subFolderCount = folder.folders ? Object.keys(folder.folders).length : 0
          const folderTotalSize = calculateFolderSize(folder)

          return (
            <div key={currentPath} className="folder-item" style={{ marginLeft: `${level * 20}px` }}>
              <div 
                className="folder-header"
                onClick={() => toggleFolder(currentPath)}
              >
                <span className="folder-icon">{isExpanded ? '📂' : '📁'}</span>
                <span className="folder-name">{folderName}</span>
                <span className="folder-count">
                  ({folderFileCount} file{folderFileCount !== 1 ? 's' : ''}
                  {subFolderCount > 0 && `, ${subFolderCount} folder${subFolderCount !== 1 ? 's' : ''}`})
                </span>
                <span className="folder-size">Total: {formatFileSize(folderTotalSize)}</span>
                <span className="folder-toggle">{isExpanded ? '▼' : '▶'}</span>
              </div>
              
              {isExpanded && (
                <div className="folder-content">
                  {folder.files && folder.files.length > 0 && (
                    <div className="files-list">
                      {folder.files.map((file, index) => (
                        <div key={index} className="file-item">
                          <span className="file-icon">📄</span>
                          <span className="file-name">{file.name}</span>
                          <span className="file-size">{file.size ? formatFileSize(file.size) : '-'}</span>
                          <span className="file-date">
                            {file.lastModified 
                              ? new Date(file.lastModified).toLocaleString()
                              : '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {folder.folders && Object.keys(folder.folders).map((subFolderName) => {
                    const subFolder = folder.folders[subFolderName]
                    // Create a structure with just this subfolder for recursive rendering
                    const subFolderStructure = {
                      folders: { [subFolderName]: subFolder },
                      files: []
                    }
                    return renderFolderStructure(subFolderStructure, currentPath, level + 1)
                  })}
                </div>
              )}
            </div>
          )
        })}
      </>
    )
  }

  return (
    <div className="fhs-database-page">
      <div className="page-header">
        <h1>FHS Database & Files</h1>
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

      <div className="tabs-container">
        <button
          className={`tab-btn ${activeTab === 'database' ? 'active' : ''}`}
          onClick={() => handleTabChange('database')}
          disabled={!selectedBackend}
          title={!selectedBackend ? 'Please select a backend first' : ''}
        >
          Database
        </button>
        <button
          className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => handleTabChange('files')}
          disabled={!selectedBackend}
          title={!selectedBackend ? 'Please select a backend first' : ''}
        >
          Files
        </button>
        {!selectedBackend && (
          <span className="tabs-hint">Please select a backend to enable tabs</span>
        )}
      </div>

      {/* Show message when backend is selected but no tab is selected */}
      {selectedBackend && !activeTab && (
        <div className="tab-selection-prompt">
          <p>Please select either <strong>Database</strong> or <strong>Files</strong> to view data</p>
        </div>
      )}

      {/* Database Tab */}
      {activeTab === 'database' && loading && (
        <div className="loading-container">
          <div className="loading">Loading database data...</div>
        </div>
      )}

      {activeTab === 'database' && !databaseData && !loading && (
        <div className="tab-selection-prompt">
          <p>No database data available. Please try again.</p>
        </div>
      )}

      {activeTab === 'database' && databaseData && !loading && (
        <div className="database-results">
          <div className="results-header">
            <div className="header-top">
              <div>
                <h2>Database: {databaseData.backendName}</h2>
                <span className="tables-count">Tables: {databaseData.tablesCount}</span>
              </div>
              <button
                className="download-excel-btn"
                onClick={() => setShowDownloadExcelModal(true)}
                title="Download table data as Excel"
              >
                📥 Download Excel
              </button>
            </div>
            <div className="database-url-container">
              <label>Database URL:</label>
              <div className="url-with-eye">
                {showDatabaseUrl ? (
                  <span className="url-text">{databaseData.databaseUrl}</span>
                ) : (
                  <span className="url-hidden">••••••••••••••••</span>
                )}
                <button
                  className="eye-icon-btn"
                  onClick={() => setShowDatabaseUrl(!showDatabaseUrl)}
                  title={showDatabaseUrl ? 'Hide URL' : 'Show URL'}
                >
                  {showDatabaseUrl ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
          </div>

          <div className="tables-buttons-container">
            <h3>Select Table:</h3>
            <div className="tables-buttons-scroll">
              {Object.keys(databaseData.tables).map((tableName) => {
                const rowCount = getTableRowCount(tableName)
                return (
                  <button
                    key={tableName}
                    className={`table-btn ${selectedTable === tableName ? 'active' : ''}`}
                    onClick={() => handleTableSelect(tableName)}
                  >
                    <span className="table-name">{tableName}</span>
                    <span className="table-count">({rowCount})</span>
                  </button>
                )
              })}
            </div>
          </div>

          {selectedTable && (
            <div className="table-data-container">
              <div className="table-data-header">
                <h3>{selectedTable}</h3>
                <span className="row-count-badge">
                  {pagination.total} records
                </span>
              </div>

              {tableLoading ? (
                <div className="table-loading">
                  <p>Loading table data...</p>
                </div>
              ) : tableData && tableData.length > 0 ? (
                <>
                  <div className="table-content-wrapper">
                    <div className="table-scroll-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            {Object.keys(tableData[0]).map((key) => (
                              <th key={key}>{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tableData.map((row, index) => (
                            <tr key={index}>
                              {Object.values(row).map((value, cellIndex) => (
                                <td key={cellIndex}>
                                  {value === null || value === undefined 
                                    ? <span className="null-value">null</span>
                                    : typeof value === 'object' 
                                      ? <span className="json-value">{JSON.stringify(value)}</span>
                                      : String(value)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {renderPagination()}
                </>
              ) : (
                <div className="table-empty">
                  <p>No data in this table</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Files Tab */}
      {activeTab === 'files' && (
        <div className="files-results">
          {filesLoading ? (
            <div className="loading-container">
              <div className="loading">Loading files...</div>
            </div>
          ) : filesData ? (
            <>
              <div className="results-header">
                <div className="header-top">
                  <h2>Files: {filesData.backendName}</h2>
                  <span className="files-count">Files: {filesData.filesCount}</span>
                  {filesData.folderStructure && (
                    <span className="total-storage">
                      Total Storage: {formatFileSize(calculateFolderSize(filesData.folderStructure))}
                    </span>
                  )}
                </div>
                <div className="database-url-container">
                  <label>Bucket URL:</label>
                  <div className="url-with-eye">
                    {showBucketUrl ? (
                      <span className="url-text">{filesData.bucketUrl}</span>
                    ) : (
                      <span className="url-hidden">••••••••••••••••</span>
                    )}
                    <button
                      className="eye-icon-btn"
                      onClick={() => setShowBucketUrl(!showBucketUrl)}
                      title={showBucketUrl ? 'Hide URL' : 'Show URL'}
                    >
                      {showBucketUrl ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>
              </div>

              {filesData.folderStructure ? (
                <>
                  <div className="files-list-container">
                    <div className="files-scroll-container">
                      <div className="folder-structure">
                        {renderFolderStructure(filesData.folderStructure, '')}
                      </div>
                    </div>
                  </div>
                  <div className="files-summary-footer">
                    <div className="summary-content">
                      <div className="summary-item">
                        <span className="summary-label">Total Files:</span>
                        <span className="summary-value">{filesData.filesCount}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Total Storage Occupied:</span>
                        <span className="summary-value highlight">
                          {formatFileSize(calculateFolderSize(filesData.folderStructure))}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="files-empty">
                  <p>No files found</p>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {showDownloadExcelModal && selectedBackend && databaseData && (
        <DownloadFhsDatabaseExcelModal
          backendName={selectedBackend}
          tables={databaseData}
          onClose={() => setShowDownloadExcelModal(false)}
        />
      )}
    </div>
  )
}

export default FhsDatabase
