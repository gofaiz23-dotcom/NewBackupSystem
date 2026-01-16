import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Settings API
export const settingsAPI = {
  // Get all settings
  getAll: (params = {}) => {
    return api.get('/api/settings', { params })
  },

  // Get single setting by ID
  getById: (id) => {
    return api.get(`/api/settings/${id}`)
  },

  // Create single setting
  create: (data) => {
    return api.post('/api/settings', data)
  },

  // Create bulk settings
  createBulk: (data) => {
    return api.post('/api/settings/bulk', { data })
  },

  // Update setting
  update: (id, data) => {
    return api.put(`/api/settings/${id}`, data)
  },

  // Delete setting
  delete: (id) => {
    return api.delete(`/api/settings/${id}`)
  },
}

export default api
