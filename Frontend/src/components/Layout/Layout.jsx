import { useState } from 'react'
import Sidebar from '../Sidebar/Sidebar'
import './Layout.css'

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  return (
    <div className="layout">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
      <div className={`main-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        {children}
      </div>
    </div>
  )
}

export default Layout
