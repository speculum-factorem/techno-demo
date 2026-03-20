import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAppSelector } from '@application/store/hooks'
import styles from './Sidebar.module.scss'

interface NavItem {
  path: string
  icon: string
  label: string
  badge?: number
}

const Sidebar: React.FC = () => {
  const { unreadCount } = useAppSelector(s => s.alerts)
  const location = useLocation()

  const navItems: NavItem[] = [
    { path: '/', icon: 'dashboard', label: 'Дашборд' },
    { path: '/fields', icon: 'grass', label: 'Поля' },
    { path: '/forecast', icon: 'trending_up', label: 'Прогноз урожая' },
    { path: '/irrigation', icon: 'water_drop', label: 'Рекомендации полива' },
    { path: '/weather', icon: 'cloud', label: 'Погода' },
    { path: '/alerts', icon: 'notifications', label: 'Уведомления', badge: unreadCount },
  ]

  return (
    <nav className={styles.sidebar}>
      <div className={styles.nav}>
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            <span className={`material-icons-round ${styles.icon}`}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
            {item.badge != null && item.badge > 0 && (
              <span className={styles.badge}>{item.badge > 9 ? '9+' : item.badge}</span>
            )}
          </NavLink>
        ))}
      </div>

      <div className={styles.footer}>
        <div className={styles.version}>v1.0.0 · Хакатон 2024</div>
      </div>
    </nav>
  )
}

export default Sidebar
