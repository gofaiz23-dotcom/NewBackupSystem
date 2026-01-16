import { useState } from 'react'
import './Modal.css'

const AddSettingModal = ({ onClose, onSave }) => {
  const [mode, setMode] = useState('single') // 'single' or 'bulk'
  const [formData, setFormData] = useState({
    backendname: '',
    DBurl: '',
    bucketurl: '',
    attributes: {}
  })
  const [bulkData, setBulkData] = useState([{ backendname: '', DBurl: '', bucketurl: '', attributes: {} }])
  const [attributesJson, setAttributesJson] = useState('{}')
  const [showDBUrl, setShowDBUrl] = useState(false)
  const [showBucketUrl, setShowBucketUrl] = useState(false)
  const [bulkVisibility, setBulkVisibility] = useState({}) // { 'index-db': true/false, 'index-bucket': true/false }

  const handleSingleSubmit = (e) => {
    e.preventDefault()
    try {
      const attributes = JSON.parse(attributesJson || '{}')
      onSave({ ...formData, attributes }, false)
    } catch (error) {
      alert('Invalid JSON in attributes field')
    }
  }

  const handleBulkSubmit = (e) => {
    e.preventDefault()
    try {
      const data = bulkData.map(item => ({
        ...item,
        attributes: typeof item.attributes === 'string' 
          ? JSON.parse(item.attributes || '{}') 
          : item.attributes
      }))
      onSave(data, true)
    } catch (error) {
      alert('Invalid JSON in attributes field')
    }
  }

  const addBulkRow = () => {
    setBulkData([...bulkData, { backendname: '', DBurl: '', bucketurl: '', attributes: {} }])
  }

  const removeBulkRow = (index) => {
    setBulkData(bulkData.filter((_, i) => i !== index))
  }

  const updateBulkRow = (index, field, value) => {
    const newData = [...bulkData]
    newData[index][field] = value
    setBulkData(newData)
  }

  const toggleBulkVisibility = (index, urlType) => {
    const key = `${index}-${urlType}`
    setBulkVisibility(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const isBulkVisible = (index, urlType) => {
    return bulkVisibility[`${index}-${urlType}`] || false
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Setting</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-tabs">
          <button
            className={mode === 'single' ? 'active' : ''}
            onClick={() => setMode('single')}
          >
            Single
          </button>
          <button
            className={mode === 'bulk' ? 'active' : ''}
            onClick={() => setMode('bulk')}
          >
            Bulk
          </button>
        </div>

        {mode === 'single' ? (
          <form onSubmit={handleSingleSubmit} className="modal-form">
            <div className="form-group">
              <label>Backend Name *</label>
              <input
                type="text"
                value={formData.backendname}
                onChange={(e) => setFormData({ ...formData, backendname: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>DB URL *</label>
              <div className="input-with-eye">
                <input
                  type={showDBUrl ? 'text' : 'password'}
                  value={formData.DBurl}
                  onChange={(e) => setFormData({ ...formData, DBurl: e.target.value })}
                  required
                  className="url-input"
                />
                <button
                  type="button"
                  className="eye-icon-btn"
                  onClick={() => setShowDBUrl(!showDBUrl)}
                  title={showDBUrl ? 'Hide URL' : 'Show URL'}
                >
                  {showDBUrl ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Bucket URL *</label>
              <div className="input-with-eye">
                <input
                  type={showBucketUrl ? 'text' : 'password'}
                  value={formData.bucketurl}
                  onChange={(e) => setFormData({ ...formData, bucketurl: e.target.value })}
                  required
                  className="url-input"
                />
                <button
                  type="button"
                  className="eye-icon-btn"
                  onClick={() => setShowBucketUrl(!showBucketUrl)}
                  title={showBucketUrl ? 'Hide URL' : 'Show URL'}
                >
                  {showBucketUrl ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Attributes (JSON)</label>
              <textarea
                value={attributesJson}
                onChange={(e) => setAttributesJson(e.target.value)}
                placeholder='{"key": "value"}'
                rows="4"
              />
            </div>
            <div className="modal-actions">
              <button type="button" onClick={onClose}>Cancel</button>
              <button type="submit">Save</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleBulkSubmit} className="modal-form">
            <div className="bulk-actions">
              <button type="button" onClick={addBulkRow}>+ Add Row</button>
            </div>
            <div className="bulk-table">
              {bulkData.map((row, index) => (
                <div key={index} className="bulk-row">
                  <div className="form-group">
                    <label>Backend Name *</label>
                    <input
                      type="text"
                      value={row.backendname}
                      onChange={(e) => updateBulkRow(index, 'backendname', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>DB URL *</label>
                    <div className="input-with-eye">
                      <input
                        type={isBulkVisible(index, 'db') ? 'text' : 'password'}
                        value={row.DBurl}
                        onChange={(e) => updateBulkRow(index, 'DBurl', e.target.value)}
                        required
                        className="url-input"
                      />
                      <button
                        type="button"
                        className="eye-icon-btn"
                        onClick={() => toggleBulkVisibility(index, 'db')}
                        title={isBulkVisible(index, 'db') ? 'Hide URL' : 'Show URL'}
                      >
                        {isBulkVisible(index, 'db') ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Bucket URL *</label>
                    <div className="input-with-eye">
                      <input
                        type={isBulkVisible(index, 'bucket') ? 'text' : 'password'}
                        value={row.bucketurl}
                        onChange={(e) => updateBulkRow(index, 'bucketurl', e.target.value)}
                        required
                        className="url-input"
                      />
                      <button
                        type="button"
                        className="eye-icon-btn"
                        onClick={() => toggleBulkVisibility(index, 'bucket')}
                        title={isBulkVisible(index, 'bucket') ? 'Hide URL' : 'Show URL'}
                      >
                        {isBulkVisible(index, 'bucket') ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Attributes (JSON)</label>
                    <input
                      type="text"
                      value={typeof row.attributes === 'string' ? row.attributes : JSON.stringify(row.attributes)}
                      onChange={(e) => updateBulkRow(index, 'attributes', e.target.value)}
                      placeholder='{"key": "value"}'
                    />
                  </div>
                  {bulkData.length > 1 && (
                    <button
                      type="button"
                      className="remove-row"
                      onClick={() => removeBulkRow(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" onClick={onClose}>Cancel</button>
              <button type="submit">Save All</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default AddSettingModal
