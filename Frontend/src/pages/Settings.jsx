import { useState, useEffect } from 'react'
import { settingsAPI } from '../services/api'
import SettingsTable from '../components/Table/SettingsTable'
import AddSettingModal from '../components/Modal/AddSettingModal'
import EditSettingModal from '../components/Modal/EditSettingModal'
import DeleteConfirmModal from '../components/Modal/DeleteConfirmModal'
import Message from '../components/Message/Message'
import './Settings.css'

const Settings = () => {
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedSetting, setSelectedSetting] = useState(null)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [filters, setFilters] = useState({
    date: '',
    startDate: '',
    endDate: ''
  })

  useEffect(() => {
    fetchSettings()
  }, [filters])

  // Auto-close message after 5 seconds
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => {
        setMessage({ type: '', text: '' })
      }, 5000) // 5 seconds

      return () => clearTimeout(timer)
    }
  }, [message.text])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const params = {}
      if (filters.date) params.date = filters.date
      if (filters.startDate) params.startDate = filters.startDate
      if (filters.endDate) params.endDate = filters.endDate

      const response = await settingsAPI.getAll(params)
      const data = response.data.data || []
      setSettings(data)
      
      if (data.length === 0) {
        setMessage({ type: 'info', text: 'No settings found' })
      } else {
        setMessage({ type: 'success', text: `Found ${data.length} setting(s)` })
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
      setMessage({ type: 'error', text: 'Failed to fetch settings' })
      setSettings([])
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setSelectedSetting(null)
    setShowAddModal(true)
  }

  const handleEdit = (setting) => {
    setSelectedSetting(setting)
    setShowEditModal(true)
  }

  const handleDelete = (setting) => {
    setSelectedSetting(setting)
    setShowDeleteModal(true)
  }

  const handleSave = async (data, isBulk = false) => {
    try {
      if (isBulk) {
        await settingsAPI.createBulk(data)
        setMessage({ type: 'success', text: 'Settings added successfully!' })
      } else {
        await settingsAPI.create(data)
        setMessage({ type: 'success', text: 'Setting added successfully!' })
      }
      setShowAddModal(false)
      fetchSettings()
    } catch (error) {
      console.error('Error saving setting:', error)
      setMessage({ type: 'error', text: 'Failed to save setting' })
    }
  }

  const handleUpdate = async (id, data) => {
    try {
      await settingsAPI.update(id, data)
      setMessage({ type: 'success', text: 'Setting updated successfully!' })
      setShowEditModal(false)
      setSelectedSetting(null)
      fetchSettings()
    } catch (error) {
      console.error('Error updating setting:', error)
      setMessage({ type: 'error', text: 'Failed to update setting' })
    }
  }

  const handleDeleteConfirm = async () => {
    try {
      await settingsAPI.delete(selectedSetting.id)
      setMessage({ type: 'success', text: 'Setting deleted successfully!' })
      setShowDeleteModal(false)
      setSelectedSetting(null)
      fetchSettings()
    } catch (error) {
      console.error('Error deleting setting:', error)
      setMessage({ type: 'error', text: 'Failed to delete setting' })
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Settings</h1>
        <button className="btn-add" onClick={handleAdd}>
          + Add New
        </button>
      </div>

      {message.text && (
        <Message
          type={message.type}
          message={message.text}
          onClose={() => setMessage({ type: '', text: '' })}
        />
      )}

      <div className="filters">
        <div className="filter-group">
          <label>Filter by Date</label>
          <input
            type="date"
            value={filters.date}
            onChange={(e) => setFilters({ ...filters, date: e.target.value, startDate: '', endDate: '' })}
          />
        </div>
        <div className="filter-group">
          <label>Start Date</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value, date: '' })}
          />
        </div>
        <div className="filter-group">
          <label>End Date</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value, date: '' })}
          />
        </div>
        <button className="btn-clear" onClick={() => setFilters({ date: '', startDate: '', endDate: '' })}>
          Clear Filters
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <SettingsTable
          settings={settings}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {showAddModal && (
        <AddSettingModal
          onClose={() => setShowAddModal(false)}
          onSave={handleSave}
        />
      )}

      {showEditModal && selectedSetting && (
        <EditSettingModal
          setting={selectedSetting}
          onClose={() => {
            setShowEditModal(false)
            setSelectedSetting(null)
          }}
          onUpdate={handleUpdate}
        />
      )}

      {showDeleteModal && selectedSetting && (
        <DeleteConfirmModal
          setting={selectedSetting}
          onClose={() => {
            setShowDeleteModal(false)
            setSelectedSetting(null)
          }}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  )
}

export default Settings
