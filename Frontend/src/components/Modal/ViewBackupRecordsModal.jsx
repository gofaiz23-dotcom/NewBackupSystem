import { useState, useEffect } from 'react'
import Message from '../Message/Message'
import './Modal.css'
import './ViewBackupRecordsModal.css'

const ViewBackupRecordsModal = ({ tableInfo, backendName, onClose }) => {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(20)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    fetchRecords()
  }, [page, limit, tableInfo])

  // Auto-close message after 5 seconds
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => {
        setMessage({ type: '', text: '' })
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [message.text])

  const fetchRecords = async () => {
    if (!tableInfo || !backendName) return

    try {
      setLoading(true)
      const tableNameWithoutPrefix = tableInfo.tableName.startsWith('backup_')
        ? tableInfo.tableName.replace('backup_', '')
        : tableInfo.tableName

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/backup/${backendName}?tableName=${tableNameWithoutPrefix}&page=${page}&limit=${limit}`
      )
      const data = await response.json()

      if (data.success) {
        setRecords(data.data || [])
        setTotal(data.total || 0)
        setTotalPages(data.totalPages || 1)
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to fetch records' })
      }
    } catch (error) {
      console.error('Error fetching records:', error)
      setMessage({ type: 'error', text: 'Failed to fetch records' })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRecord = async (recordId) => {
    if (!window.confirm(`Are you sure you want to delete record with ID ${recordId}? This action cannot be undone.`)) {
      return
    }

    try {
      setDeletingId(recordId)
      setMessage({ type: '', text: '' })

      const tableNameWithoutPrefix = tableInfo.tableName.startsWith('backup_')
        ? tableInfo.tableName.replace('backup_', '')
        : tableInfo.tableName

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/backup/${backendName}/${tableNameWithoutPrefix}/${recordId}`,
        {
          method: 'DELETE'
        }
      )

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Record deleted successfully' })
        // Refresh records
        await fetchRecords()
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to delete record' })
      }
    } catch (error) {
      console.error('Error deleting record:', error)
      setMessage({ type: 'error', text: 'Failed to delete record' })
    } finally {
      setDeletingId(null)
    }
  }

  const getColumnNames = () => {
    if (records.length === 0) return []
    return Object.keys(records[0]).filter(key => 
      key !== 'backup_created_at' && key !== 'backup_updated_at'
    )
  }

  const formatValue = (value) => {
    if (value === null || value === undefined) return 'NULL'
    if (typeof value === 'object') return JSON.stringify(value)
    if (typeof value === 'boolean') return value ? 'true' : 'false'
    return String(value)
  }

  const columnNames = getColumnNames()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content view-records-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>View Records: {tableInfo?.tableName}</h2>
            <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#7f8c8d' }}>
              Original Table: {tableInfo?.originalTableName}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {message.text && (
          <Message
            type={message.type}
            message={message.text}
            onClose={() => setMessage({ type: '', text: '' })}
          />
        )}

        <div className="modal-body">
          <div className="records-info">
            <span>Total Records: <strong>{total}</strong></span>
            <span>Page: <strong>{page}</strong> of <strong>{totalPages}</strong></span>
            <span>
              Records per page:
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value))
                  setPage(1)
                }}
                className="limit-select"
                disabled={loading}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </span>
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="loading">Loading records...</div>
            </div>
          ) : records.length === 0 ? (
            <div className="no-records">
              <p>No records found in this table</p>
            </div>
          ) : (
            <>
              <div className="records-table-container">
                <table className="records-table">
                  <thead>
                    <tr>
                      {columnNames.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                      <th className="actions-column">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id}>
                        {columnNames.map((col) => (
                          <td key={col} className="record-cell">
                            {formatValue(record[col])}
                          </td>
                        ))}
                        <td className="actions-cell">
                          <button
                            className="delete-record-btn"
                            onClick={() => handleDeleteRecord(record.id)}
                            disabled={deletingId === record.id}
                            title="Delete this record"
                          >
                            {deletingId === record.id ? 'Deleting...' : '🗑️ Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 0 && (
                <div className="pagination">
                  <button
                    className="pagination-btn"
                    onClick={() => setPage(1)}
                    disabled={page === 1 || loading}
                    title="First page"
                  >
                    ⏮ First
                  </button>
                  <button
                    className="pagination-btn"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                  >
                    ← Previous
                  </button>
                  <span className="pagination-info">
                    Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total records)
                  </span>
                  <button
                    className="pagination-btn"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                  >
                    Next →
                  </button>
                  <button
                    className="pagination-btn"
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages || loading}
                    title="Last page"
                  >
                    Last ⏭
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default ViewBackupRecordsModal
