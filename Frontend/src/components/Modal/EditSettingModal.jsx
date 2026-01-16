import { useState, useEffect } from 'react'
import './Modal.css'

const EditSettingModal = ({ setting, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    backendname: '',
    DBurl: '',
    bucketurl: '',
    attributes: {}
  })
  const [attributesJson, setAttributesJson] = useState('{}')
  const [showDBUrl, setShowDBUrl] = useState(false)
  const [showBucketUrl, setShowBucketUrl] = useState(false)

  useEffect(() => {
    if (setting) {
      setFormData({
        backendname: setting.backendname || '',
        DBurl: setting.DBurl || '',
        bucketurl: setting.bucketurl || '',
        attributes: setting.attributes || {}
      })
      setAttributesJson(JSON.stringify(setting.attributes || {}, null, 2))
    }
  }, [setting])

  const handleSubmit = (e) => {
    e.preventDefault()
    try {
      const attributes = JSON.parse(attributesJson || '{}')
      onUpdate(setting.id, { ...formData, attributes })
    } catch (error) {
      alert('Invalid JSON in attributes field')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Setting</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
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
            <button type="submit">Update</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditSettingModal
