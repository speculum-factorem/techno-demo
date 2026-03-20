import React from 'react'
import { NavLink } from 'react-router-dom'
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
  const navItems: NavItem[] = [
    { path: '/app', icon: 'dashboard', label: 'Дашборд' },
    { path: '/app/fields', icon: 'grass', label: 'Поля' },
    { path: '/app/forecast', icon: 'trending_up', label: 'Прогноз урожая' },
    { path: '/app/irrigation', icon: 'water_drop', label: 'Рекомендации полива' },
    { path: '/app/weather', icon: 'cloud', label: 'Погода' },
    { path: '/app/alerts', icon: 'notifications', label: 'Уведомления', badge: unreadCount },
    { path: '/app/model-metrics', icon: 'model_training', label: 'Метрики модели' },
    { path: '/app/field-insights', icon: 'fact_check', label: 'Паспорт и финансы' },
    { path: '/app/scenario-planner', icon: 'science', label: 'Сценарии что если' },
  ]

  return (
    <nav className={styles.sidebar}>
      <div className={styles.nav}>
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/app'}
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
