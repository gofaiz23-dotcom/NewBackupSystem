import { NavLink } from 'react-router-dom'
import './Sidebar.css'

const Sidebar = ({ isOpen, toggleSidebar }) => {
  return (
    <div className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <h2 className={isOpen ? '' : 'hidden'}>Backup System</h2>
        <button className="toggle-btn" onClick={toggleSidebar}>
          {isOpen ? '◀' : '▶'}
        </button>
      </div>
      
      <nav className="sidebar-nav">
        <NavLink 
          to="/dashboard" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">📊</span>
          {isOpen && <span className="nav-text">Dashboard</span>}
        </NavLink>
        <NavLink 
          to="/settings" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">⚙️</span>
          {isOpen && <span className="nav-text">Settings</span>}
        </NavLink>
        <NavLink 
          to="/fhs-database" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">🗄️</span>
          {isOpen && <span className="nav-text">Database</span>}
        </NavLink>
        <NavLink 
          to="/backup" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">💾</span>
          {isOpen && <span className="nav-text">Backup</span>}
        </NavLink>
        <NavLink 
          to="/backup-data" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">📊</span>
          {isOpen && <span className="nav-text">Backup-Data</span>}
        </NavLink>
        <NavLink 
          to="/comparison" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">🔍</span>
          {isOpen && <span className="nav-text">Comparison</span>}
        </NavLink>
        <NavLink 
          to="/auto-backup-status" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">🔄</span>
          {isOpen && <span className="nav-text">Auto-Backup Status</span>}
        </NavLink>
        <NavLink 
          to="/upload-local-remote" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">📤</span>
          {isOpen && <span className="nav-text">Upload Local-Remote</span>}
        </NavLink>
      </nav>
    </div>
  )
}

export default Sidebar
