import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAppSelector } from '@application/store/hooks'
import styles from './Sidebar.module.scss'

interface NavItem {
  path: string
  icon: string
  label: string
  badge?: number
}

interface NavGroup {
  title: string
  items: NavItem[]
}

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const { unreadCount } = useAppSelector(s => s.alerts)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const groups: NavGroup[] = [
    {
      title: 'Основное',
      items: [
        { path: '/app', icon: 'dashboard', label: 'Дашборд' },
        { path: '/app/fields', icon: 'grass', label: 'Поля' },
        { path: '/app/weather', icon: 'cloud', label: 'Погода' },
      ],
    },
    {
      title: 'Аналитика и ML',
      items: [
        { path: '/app/forecast', icon: 'trending_up', label: 'Прогноз урожая' },
        { path: '/app/irrigation', icon: 'water_drop', label: 'Рекомендации полива' },
        { path: '/app/satellite', icon: 'satellite_alt', label: 'Спутник' },
        { path: '/app/model-metrics', icon: 'model_training', label: 'Точность прогноза' },
      ],
    },
    {
      title: 'Планирование',
      items: [
        { path: '/app/scenario-planner', icon: 'science', label: 'Сценарии «что если»' },
        { path: '/app/work-planner', icon: 'assignment', label: 'Планировщик работ' },
        { path: '/app/field-insights', icon: 'fact_check', label: 'Паспорт поля' },
      ],
    },
    {
      title: 'Техника и данные',
      items: [
        { path: '/app/equipment', icon: 'device_hub', label: 'Техника и сенсоры' },
        { path: '/app/integrations', icon: 'cable', label: 'Интеграции' },
      ],
    },
    {
      title: 'Управление',
      items: [
        { path: '/app/alerts', icon: 'notifications', label: 'Уведомления', badge: unreadCount },
        { path: '/app/notification-rules', icon: 'rule', label: 'Правила алертов' },
        { path: '/app/reports', icon: 'description', label: 'Отчёты' },
        { path: '/app/rbac', icon: 'manage_accounts', label: 'Роли и права' },
        { path: '/app/audit', icon: 'manage_history', label: 'Журнал аудита' },
      ],
    },
  ]

  const toggleGroup = (title: string) => {
    setCollapsed(prev => ({ ...prev, [title]: !prev[title] }))
  }

  return (
    <nav className={`${styles.sidebar} ${open ? styles.open : ''}`}>
      <div className={styles.nav}>
        {groups.map(group => (
          <div key={group.title} className={styles.group}>
            <button className={styles.groupHeader} onClick={() => toggleGroup(group.title)}>
              <span className={styles.groupTitle}>{group.title}</span>
              <span className={`material-icons-round ${styles.groupChevron} ${collapsed[group.title] ? styles.chevronCollapsed : ''}`}>
                expand_more
              </span>
            </button>
            {!collapsed[group.title] && (
              <div className={styles.groupItems}>
                {group.items.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/app'}
                    className={({ isActive }) =>
                      `${styles.navItem} ${isActive ? styles.active : ''}`
                    }
                    onClick={onClose}
                  >
                    <span className={`material-icons-round ${styles.icon}`}>{item.icon}</span>
                    <span className={styles.label}>{item.label}</span>
                    {item.badge != null && item.badge > 0 && (
                      <span className={styles.badge}>{item.badge > 9 ? '9+' : item.badge}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <div className={styles.version}>v2.0.0 · Хакатон 2025</div>
      </div>
    </nav>
  )
}

export default Sidebar
