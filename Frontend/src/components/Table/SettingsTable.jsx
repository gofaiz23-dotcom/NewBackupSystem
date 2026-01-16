import { useState } from 'react'
import './SettingsTable.css'

const SettingsTable = ({ settings, onEdit, onDelete }) => {
  const [visibleUrls, setVisibleUrls] = useState({})

  const toggleUrlVisibility = (settingId, urlType) => {
    const key = `${settingId}-${urlType}`
    setVisibleUrls(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const isUrlVisible = (settingId, urlType) => {
    return visibleUrls[`${settingId}-${urlType}`] || false
  }

  return (
    <div className="table-container">
      <table className="settings-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Backend Name</th>
            <th>DB URL</th>
            <th>Bucket URL</th>
            <th>Created At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {settings.length === 0 ? (
            <tr>
              <td colSpan="6" className="no-data">
                No settings found
              </td>
            </tr>
          ) : (
            settings.map((setting) => (
              <tr key={setting.id}>
                <td>{setting.id}</td>
                <td>{setting.backendname}</td>
                <td className="url-cell">
                  <div className="url-cell-content">
                    {isUrlVisible(setting.id, 'db') ? (
                      <span className="url-text">{setting.DBurl}</span>
                    ) : (
                      <span className="url-hidden">••••••••••••••••</span>
                    )}
                    <button
                      className="eye-icon-btn"
                      onClick={() => toggleUrlVisibility(setting.id, 'db')}
                      title={isUrlVisible(setting.id, 'db') ? 'Hide URL' : 'Show URL'}
                    >
                      {isUrlVisible(setting.id, 'db') ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </td>
                <td className="url-cell">
                  <div className="url-cell-content">
                    {isUrlVisible(setting.id, 'bucket') ? (
                      <span className="url-text">{setting.bucketurl}</span>
                    ) : (
                      <span className="url-hidden">••••••••••••••••</span>
                    )}
                    <button
                      className="eye-icon-btn"
                      onClick={() => toggleUrlVisibility(setting.id, 'bucket')}
                      title={isUrlVisible(setting.id, 'bucket') ? 'Hide URL' : 'Show URL'}
                    >
                      {isUrlVisible(setting.id, 'bucket') ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </td>
                <td>{new Date(setting.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn-edit"
                      onClick={() => onEdit(setting)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => onDelete(setting)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default SettingsTable
