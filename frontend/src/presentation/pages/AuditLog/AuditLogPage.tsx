import React, { useEffect, useState } from 'react'
import styles from './AuditLogPage.module.scss'
import { AuditEntry, AuditAction } from '@domain/entities/AuditLog'
import { opsApi } from '@infrastructure/api/OpsApi'

const ACTION_ICONS: Record<AuditAction, string> = {
  login: 'login', logout: 'logout',
  field_update: 'edit', field_create: 'add_circle', field_delete: 'delete',
  recommendation_accept: 'thumb_up', recommendation_reject: 'thumb_down',
  forecast_run: 'trending_up',
  settings_change: 'settings',
  user_invite: 'person_add', user_role_change: 'manage_accounts', user_delete: 'person_remove',
  alert_rule_create: 'add_alert', alert_rule_update: 'edit_notifications', alert_rule_delete: 'notification_remove',
  export_pdf: 'picture_as_pdf', export_excel: 'table_chart',
  integration_connect: 'cable', integration_disconnect: 'link_off',
}

const ACTION_LABELS: Record<AuditAction, string> = {
  login: 'Вход', logout: 'Выход',
  field_update: 'Изменение поля', field_create: 'Создание поля', field_delete: 'Удаление поля',
  recommendation_accept: 'Принятие рекомендации', recommendation_reject: 'Отклонение',
  forecast_run: 'Запуск прогноза',
  settings_change: 'Изменение настроек',
  user_invite: 'Приглашение', user_role_change: 'Смена роли', user_delete: 'Удаление пользователя',
  alert_rule_create: 'Создание правила', alert_rule_update: 'Изменение правила', alert_rule_delete: 'Удаление правила',
  export_pdf: 'Экспорт PDF', export_excel: 'Экспорт Excel',
  integration_connect: 'Подключение интеграции', integration_disconnect: 'Отключение интеграции',
}

const AuditLogPage: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [search, setSearch] = useState('')
  const [filterUser, setFilterUser] = useState('all')
  const [filterResult, setFilterResult] = useState<'all' | 'success' | 'failure'>('all')

  useEffect(() => {
    opsApi.getAuditLog().then(setEntries).catch(() => setEntries([]))
  }, [])

  const users = [...new Set(entries.map(e => e.userName))]

  const filtered = entries.filter(e => {
    if (filterUser !== 'all' && e.userName !== filterUser) return false
    if (filterResult !== 'all' && e.result !== filterResult) return false
    if (search && !`${e.userName} ${ACTION_LABELS[e.action]} ${e.entityName} ${e.details}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}><span className="material-icons-round">manage_history</span> Журнал аудита</h1>
          <p className={styles.sub}>Полная история действий пользователей в системе</p>
        </div>
        <button className={styles.exportBtn}><span className="material-icons-round">download</span> Экспорт CSV</button>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}><span className="material-icons-round" style={{ color: '#1a73e8' }}>receipt_long</span><strong>{entries.length}</strong><span>Всего событий</span></div>
        <div className={styles.statCard}><span className="material-icons-round" style={{ color: '#34a853' }}>check_circle</span><strong>{entries.filter(e => e.result === 'success').length}</strong><span>Успешных</span></div>
        <div className={styles.statCard}><span className="material-icons-round" style={{ color: '#ea4335' }}>cancel</span><strong>{entries.filter(e => e.result === 'failure').length}</strong><span>Отказов</span></div>
        <div className={styles.statCard}><span className="material-icons-round" style={{ color: '#f9ab00' }}>people</span><strong>{users.length}</strong><span>Пользователей</span></div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.searchBox}>
          <span className="material-icons-round">search</span>
          <input className={styles.searchInput} placeholder="Поиск по действиям, объектам, пользователям..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className={styles.select} value={filterUser} onChange={e => setFilterUser(e.target.value)}>
          <option value="all">Все пользователи</option>
          {users.map(u => <option key={u}>{u}</option>)}
        </select>
        <select className={styles.select} value={filterResult} onChange={e => setFilterResult(e.target.value as any)}>
          <option value="all">Все результаты</option>
          <option value="success">Успешно</option>
          <option value="failure">Отказано</option>
        </select>
      </div>

      {/* Timeline */}
      <div className={styles.timeline}>
        {filtered.map(entry => (
          <div key={entry.id} className={`${styles.entry} ${entry.result === 'failure' ? styles.entryFail : ''}`}>
            <div className={styles.entryIcon}>
              <span className="material-icons-round" style={{ color: entry.result === 'failure' ? '#ea4335' : '#1a73e8', fontSize: 18 }}>
                {ACTION_ICONS[entry.action]}
              </span>
            </div>
            <div className={styles.entryDot} style={{ background: entry.result === 'failure' ? '#ea4335' : '#34a853' }} />
            <div className={styles.entryContent}>
              <div className={styles.entryTop}>
                <span className={styles.entryAction}>{ACTION_LABELS[entry.action]}</span>
                {entry.entityName && <span className={styles.entryEntity}>→ {entry.entityName}</span>}
                <span className={`${styles.entryResult} ${entry.result === 'failure' ? styles.resultFail : styles.resultOk}`}>
                  {entry.result === 'success' ? 'Успешно' : 'Отказано'}
                </span>
              </div>
              <div className={styles.entryDetails}>{entry.details}</div>
              <div className={styles.entryMeta}>
                <span className={styles.entryUser}><span className="material-icons-round" style={{ fontSize: 12 }}>person</span> {entry.userName} ({entry.userRole})</span>
                <span><span className="material-icons-round" style={{ fontSize: 12 }}>schedule</span> {new Date(entry.timestamp).toLocaleString('ru-RU')}</span>
                <span><span className="material-icons-round" style={{ fontSize: 12 }}>router</span> {entry.ipAddress}</span>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className={styles.empty}><span className="material-icons-round">search_off</span><p>Нет записей по выбранным фильтрам</p></div>
        )}
      </div>
    </div>
  )
}

export default AuditLogPage
