import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import Message from '../Message/Message'
import './Modal.css'
import './DownloadExcelModal.css'

const DownloadFhsDatabaseExcelModal = ({ backendName, tables, onClose }) => {
  const [selectedTable, setSelectedTable] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  // Auto-close message after 5 seconds
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => {
        setMessage({ type: '', text: '' })
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [message.text])

  const handleDownload = async () => {
    if (!selectedTable || !backendName) {
      setMessage({ type: 'error', text: 'Please select a table' })
      return
    }

    try {
      setLoading(true)
      setMessage({ type: '', text: '' })

      // Fetch all data (we'll fetch in chunks and combine)
      let allData = []
      let page = 1
      const limit = 1000
      let hasMore = true

      while (hasMore) {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/getallDatafromdb/${backendName}/${selectedTable}?page=${page}&limit=${limit}`
        )
        const data = await response.json()

        if (data.success && data.data && data.data.length > 0) {
          allData = [...allData, ...data.data]
          
          if (data.data.length < limit || page >= data.totalPages) {
            hasMore = false
          } else {
            page++
          }
        } else {
          hasMore = false
        }
      }

      if (allData.length === 0) {
        setMessage({ type: 'error', text: 'No data found in this table' })
        setLoading(false)
        return
      }

      // Convert data to Excel format
      const filteredData = allData.map(record => {
        const filtered = {}
        Object.keys(record).forEach(key => {
          // Convert BigInt and other non-serializable values
          let value = record[key]
          if (value === null || value === undefined) {
            filtered[key] = ''
          } else if (typeof value === 'bigint' || (typeof value === 'string' && /^\d+n$/.test(value))) {
            filtered[key] = String(value).replace('n', '')
          } else if (typeof value === 'object') {
            filtered[key] = JSON.stringify(value)
          } else {
            filtered[key] = value
          }
        })
        return filtered
      })

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(filteredData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, selectedTable)

      // Set column widths
      const maxWidth = 50
      const colWidths = Object.keys(filteredData[0] || {}).map(key => ({
        wch: Math.min(Math.max(key.length, 10), maxWidth)
      }))
      worksheet['!cols'] = colWidths

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const filename = `${backendName}_${selectedTable}_${timestamp}.xlsx`

      // Download file
      XLSX.writeFile(workbook, filename)

      setMessage({ type: 'success', text: `Excel file downloaded successfully: ${filename}` })
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (error) {
      console.error('Error downloading Excel:', error)
      setMessage({ type: 'error', text: `Failed to download Excel: ${error.message}` })
    } finally {
      setLoading(false)
    }
  }

  const getTableOptions = () => {
    if (!tables || !tables.tables) return []
    
    return Object.entries(tables.tables)
      .filter(([tableName, tableInfo]) => !tableInfo.error && (tableInfo.count || 0) > 0)
      .map(([tableName, tableInfo]) => ({
        value: tableName,
        label: `${tableName} (${tableInfo.count || 0} records)`,
        count: tableInfo.count || 0
      }))
  }

  const tableOptions = getTableOptions()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content download-excel-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Download Excel</h2>
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
            <label htmlFor="table-select">Select Table:</label>
            <select
              id="table-select"
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="table-select"
              disabled={loading || tableOptions.length === 0}
            >
              <option value="">-- Select a table --</option>
              {tableOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {tableOptions.length === 0 && (
              <p className="no-tables-message">No tables with data available</p>
            )}
          </div>

          {selectedTable && (
            <div className="download-info">
              <p>
                <strong>Backend:</strong> {backendName}
              </p>
              <p>
                <strong>Table:</strong> {selectedTable}
              </p>
              <p>
                <strong>Records:</strong> {tableOptions.find(opt => opt.value === selectedTable)?.count || 0}
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleDownload}
            disabled={!selectedTable || loading || tableOptions.length === 0}
          >
            {loading ? 'Downloading...' : '📥 Download Excel'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DownloadFhsDatabaseExcelModal
