import { useState, useEffect } from 'react'
import { settingsAPI } from '../../services/api'
import Message from '../Message/Message'
import './Modal.css'
import './DeleteBackupModal.css'

const DeleteBackupModal = ({ tableInfo, backendNames, onClose, onSuccess }) => {
  const [selectedBackend, setSelectedBackend] = useState(tableInfo?.backendName || '')
  const [availableTables, setAvailableTables] = useState([])
  const [selectedTable, setSelectedTable] = useState(tableInfo?.tableName || '')
  const [deleteType, setDeleteType] = useState('all') // 'all' or 'dateRange'
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingTables, setLoadingTables] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (selectedBackend) {
      fetchTables()
      setShowConfirm(false) // Reset confirmation when backend changes
    } else {
      setAvailableTables([])
      setSelectedTable('')
    }
  }, [selectedBackend])

  useEffect(() => {
    if (tableInfo) {
      setSelectedBackend(tableInfo.backendName)
      setSelectedTable(tableInfo.tableName)
    }
  }, [tableInfo])

  useEffect(() => {
    // Reset confirmation when table or delete type changes
    setShowConfirm(false)
  }, [selectedTable, deleteType])

  const fetchTables = async () => {
    try {
      setLoadingTables(true)
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/backup/${selectedBackend}`)
      const data = await response.json()

      if (data.success && data.tables) {
        const tables = Object.keys(data.tables).map(tableName => ({
          tableName,
          originalTableName: data.tables[tableName].originalTableName || tableName.replace('backup_', ''),
          count: data.tables[tableName].count || 0
        }))
        setAvailableTables(tables)
      } else {
        setAvailableTables([])
      }
    } catch (error) {
      console.error('Error fetching tables:', error)
      setAvailableTables([])
    } finally {
      setLoadingTables(false)
    }
  }

  const handleDeleteClick = () => {
    if (!selectedBackend || !selectedTable) {
      setMessage({ type: 'error', text: 'Please select backend and table' })
      return
    }

    if (deleteType === 'dateRange' && (!startDate || !endDate)) {
      setMessage({ type: 'error', text: 'Please provide both start and end dates' })
      return
    }

    // Show confirmation
    setShowConfirm(true)
  }

  const handleConfirmDelete = async () => {
    try {
      setLoading(true)
      setMessage({ type: '', text: '' })
      setShowConfirm(false)

      // Extract table name without 'backup_' prefix
      const tableNameWithoutPrefix = selectedTable.startsWith('backup_') 
        ? selectedTable.replace('backup_', '') 
        : selectedTable

      let response
      if (deleteType === 'all') {
        // Delete all records from table
        response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/backup/${selectedBackend}/${tableNameWithoutPrefix}`,
          {
            method: 'DELETE'
          }
        )
      } else {
        // Delete by date range
        response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/backup/${selectedBackend}/${tableNameWithoutPrefix}/date-range`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              startDate,
              endDate
            })
          }
        )
      }

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: `Successfully deleted ${data.deletedCount || 'records'} from local database` })
        setTimeout(() => {
          onSuccess()
        }, 1500)
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to delete records' })
      }
    } catch (error) {
      console.error('Error deleting records:', error)
      setMessage({ type: 'error', text: 'Failed to delete records from local database' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content delete-backup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Delete Backup Records</h2>
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
            <label>Backup Table Name *</label>
            {loadingTables ? (
              <div className="loading-text">Loading tables...</div>
            ) : availableTables.length === 0 ? (
              <div className="no-tables-message">
                {selectedBackend ? 'No backup tables found for this backend' : 'Please select a backend first'}
              </div>
            ) : (
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="form-select"
                disabled={!selectedBackend || loading}
              >
                <option value="">Select Backup Table</option>
                {availableTables.map((table) => (
                  <option key={table.tableName} value={table.tableName}>
                    {table.tableName} ({table.originalTableName}) - {table.count} records
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group">
            <label>Delete Type *</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="deleteType"
                  value="all"
                  checked={deleteType === 'all'}
                  onChange={(e) => setDeleteType(e.target.value)}
                  disabled={loading}
                />
                <span>Delete All Records</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="deleteType"
                  value="dateRange"
                  checked={deleteType === 'dateRange'}
                  onChange={(e) => setDeleteType(e.target.value)}
                  disabled={loading}
                />
                <span>Delete by Date Range</span>
              </label>
            </div>
          </div>

          {deleteType === 'dateRange' && (
            <>
              <div className="form-group">
                <label>Start Date *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="form-input"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label>End Date *</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="form-input"
                  disabled={loading}
                />
              </div>
            </>
          )}

          {!showConfirm && (
            <div className="warning-box">
              <strong>⚠️ Warning:</strong> This will permanently delete records from the local backup database. This action cannot be undone.
            </div>
          )}

          {showConfirm && (
            <div className="confirm-box">
              <strong>⚠️ Final Confirmation:</strong>
              <p>Are you absolutely sure you want to delete {deleteType === 'all' ? 'ALL records' : 'records in the selected date range'} from:</p>
              <ul>
                <li><strong>Backend:</strong> {selectedBackend}</li>
                <li><strong>Table:</strong> {selectedTable}</li>
                {deleteType === 'dateRange' && (
                  <>
                    <li><strong>Start Date:</strong> {startDate}</li>
                    <li><strong>End Date:</strong> {endDate}</li>
                  </>
                )}
              </ul>
              <p className="confirm-warning">This action cannot be undone!</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {showConfirm ? (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setShowConfirm(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Yes, Delete Now'}
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteClick}
                disabled={loading || !selectedBackend || !selectedTable}
              >
                Continue to Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default DeleteBackupModal
