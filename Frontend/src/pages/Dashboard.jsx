import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import Message from '../components/Message/Message'
import './Dashboard.css'

const Dashboard = () => {
  const [reportsData, setReportsData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    fetchReports()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchReports, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchReports = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/reports`)
      const data = await response.json()

      if (data.success) {
        setReportsData(data.data)
        setMessage({ type: '', text: '' })
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to fetch reports' })
      }
    } catch (error) {
      console.error('Error fetching reports:', error)
      setMessage({ type: 'error', text: 'Failed to fetch reports' })
    } finally {
      setLoading(false)
    }
  }

  // Auto-close message after 5 seconds
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => {
        setMessage({ type: '', text: '' })
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [message.text])

  if (loading && !reportsData) {
    return (
      <div className="dashboard-page">
        <div className="loading-container">
          <div className="loading">Loading dashboard...</div>
        </div>
      </div>
    )
  }

  if (!reportsData) {
    return (
      <div className="dashboard-page">
        <div className="error-container">
          <p>No data available</p>
        </div>
      </div>
    )
  }

  const { summary, statusDistribution, typeDistribution, dailyChartData, backendStats, recentBackups } = reportsData

  // Colors for charts
  const COLORS = ['#27ae60', '#e74c3c', '#3498db', '#f39c12', '#9b59b6']

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1>📊 Dashboard</h1>
        <button className="refresh-btn" onClick={fetchReports} disabled={loading}>
          🔄 Refresh
        </button>
      </div>

      {message.text && (
        <Message
          type={message.type}
          message={message.text}
          onClose={() => setMessage({ type: '', text: '' })}
        />
      )}

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon" style={{ background: '#3498db' }}>📦</div>
          <div className="card-content">
            <h3>Total Backups</h3>
            <p className="card-value">{summary.totalBackups}</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon" style={{ background: '#27ae60' }}>✅</div>
          <div className="card-content">
            <h3>Completed</h3>
            <p className="card-value">{summary.completedBackups}</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon" style={{ background: '#e74c3c' }}>❌</div>
          <div className="card-content">
            <h3>Failed</h3>
            <p className="card-value">{summary.failedBackups}</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon" style={{ background: '#f39c12' }}>⏳</div>
          <div className="card-content">
            <h3>Processing</h3>
            <p className="card-value">{summary.processingBackups}</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon" style={{ background: '#9b59b6' }}>📈</div>
          <div className="card-content">
            <h3>Success Rate</h3>
            <p className="card-value">{summary.successRate}%</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon" style={{ background: '#16a085' }}>🗄️</div>
          <div className="card-content">
            <h3>Backup Tables</h3>
            <p className="card-value">{summary.totalBackupTables}</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon" style={{ background: '#2980b9' }}>📝</div>
          <div className="card-content">
            <h3>Total Records</h3>
            <p className="card-value">{summary.totalBackupRecords.toLocaleString()}</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon" style={{ background: '#8e44ad' }}>🕐</div>
          <div className="card-content">
            <h3>Recent (7 days)</h3>
            <p className="card-value">{summary.recentBackupsCount}</p>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="charts-row">
        {/* Status Distribution Pie Chart */}
        <div className="chart-card">
          <h3>Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Type Distribution Pie Chart */}
        <div className="chart-card">
          <h3>Backup Type Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={typeDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {typeDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily Activity Chart */}
      <div className="chart-card full-width">
        <h3>Daily Backup Activity (Last 30 Days)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="completed" 
              stroke="#27ae60" 
              strokeWidth={2}
              name="Completed"
            />
            <Line 
              type="monotone" 
              dataKey="failed" 
              stroke="#e74c3c" 
              strokeWidth={2}
              name="Failed"
            />
            <Line 
              type="monotone" 
              dataKey="processing" 
              stroke="#3498db" 
              strokeWidth={2}
              name="Processing"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Backend Statistics */}
      {Object.keys(backendStats).length > 0 && (
        <div className="chart-card full-width">
          <h3>Backend Statistics</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={Object.entries(backendStats).map(([name, stats]) => ({ name, ...stats }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="completed" fill="#27ae60" name="Completed" />
              <Bar dataKey="failed" fill="#e74c3c" name="Failed" />
              <Bar dataKey="processing" fill="#3498db" name="Processing" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Backups Table */}
      {recentBackups && recentBackups.length > 0 && (
        <div className="recent-backups-card">
          <h3>Recent Backups</h3>
          <div className="table-container">
            <table className="recent-backups-table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Backend</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {recentBackups.map((backup) => (
                  <tr key={backup.jobId}>
                    <td className="job-id-cell">{backup.jobId}</td>
                    <td>{backup.backendName}</td>
                    <td>
                      <span className={`type-badge ${backup.type}`}>
                        {backup.type}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${backup.status}`}>
                        {backup.status}
                      </span>
                    </td>
                    <td>{backup.progress}%</td>
                    <td>{new Date(backup.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
