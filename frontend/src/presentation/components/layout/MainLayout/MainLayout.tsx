import React, { useState, useCallback, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from '../Header/Header'
import Sidebar from '../Sidebar/Sidebar'
import styles from './MainLayout.module.scss'

const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  const toggleSidebar = useCallback(() => setSidebarOpen(v => !v), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className={styles.root}>
      <Header onMenuClick={toggleSidebar} />
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      {sidebarOpen && <div className={styles.overlay} onClick={closeSidebar} />}
      <main className={styles.main}>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default MainLayout
