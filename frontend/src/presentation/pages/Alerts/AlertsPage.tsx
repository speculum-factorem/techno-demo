import React, { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@application/store/hooks'
import { fetchAlerts, markAlertRead, markAllRead } from '@application/store/slices/alertsSlice'
import Card from '@presentation/components/common/Card/Card'
import Badge from '@presentation/components/common/Badge/Badge'
import Button from '@presentation/components/common/Button/Button'
import Loader from '@presentation/components/common/Loader/Loader'
import { Alert } from '@domain/entities/Alert'
import styles from './AlertsPage.module.scss'

const severityConfig = {
  critical: { label: 'Критично', variant: 'danger' as const, icon: 'error' },
  warning: { label: 'Предупреждение', variant: 'warning' as const, icon: 'warning' },
  info: { label: 'Информация', variant: 'info' as const, icon: 'info' },
}

const typeConfig: Record<string, { label: string; icon: string }> = {
  anomaly: { label: 'Аномалия данных', icon: 'analytics' },
  forecast: { label: 'Прогноз', icon: 'trending_up' },
  irrigation: { label: 'Полив', icon: 'water_drop' },
  system: { label: 'Система', icon: 'settings' },
  weather: { label: 'Погода', icon: 'cloud' },
}

const AlertsPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { items: alerts, unreadCount, loading } = useAppSelector(s => s.alerts)

  useEffect(() => { dispatch(fetchAlerts()) }, [dispatch])

  const critical = alerts.filter(a => a.severity === 'critical')
  const warning = alerts.filter(a => a.severity === 'warning')
  const info = alerts.filter(a => a.severity === 'info')

  if (loading && alerts.length === 0) return <Loader text="Загрузка уведомлений..." fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Уведомления и алерты</h1>
          <p className={styles.subtitle}>
            {unreadCount > 0 ? `${unreadCount} непрочитанных уведомлений` : 'Все уведомления прочитаны'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outlined" size="sm" icon="done_all" onClick={() => dispatch(markAllRead())}>
            Прочитать все
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={`${styles.statChip} ${styles.danger}`}>
          <span className="material-icons-round">error</span>
          {critical.length} критических
        </div>
        <div className={`${styles.statChip} ${styles.warning}`}>
          <span className="material-icons-round">warning</span>
          {warning.length} предупреждений
        </div>
        <div className={`${styles.statChip} ${styles.info}`}>
          <span className="material-icons-round">info</span>
          {info.length} информационных
        </div>
      </div>

      {/* Alert groups */}
      {critical.length > 0 && (
        <div className={styles.section}>
          <h2 className={`${styles.sectionTitle} ${styles.danger}`}>
            <span className="material-icons-round">error</span>
            Критические
          </h2>
          <div className={styles.alertsList}>
            {critical.map(a => <AlertCard key={a.id} alert={a} onRead={() => dispatch(markAlertRead(a.id))} />)}
          </div>
        </div>
      )}

      {warning.length > 0 && (
        <div className={styles.section}>
          <h2 className={`${styles.sectionTitle} ${styles.warning}`}>
            <span className="material-icons-round">warning</span>
            Предупреждения
          </h2>
          <div className={styles.alertsList}>
            {warning.map(a => <AlertCard key={a.id} alert={a} onRead={() => dispatch(markAlertRead(a.id))} />)}
          </div>
        </div>
      )}

      {info.length > 0 && (
        <div className={styles.section}>
          <h2 className={`${styles.sectionTitle} ${styles.info}`}>
            <span className="material-icons-round">info</span>
            Информационные
          </h2>
          <div className={styles.alertsList}>
            {info.map(a => <AlertCard key={a.id} alert={a} onRead={() => dispatch(markAlertRead(a.id))} />)}
          </div>
        </div>
      )}

      {alerts.length === 0 && (
        <Card className={styles.emptyState}>
          <span className="material-icons-round">notifications_off</span>
          <h3>Нет уведомлений</h3>
          <p>Все системы работают в штатном режиме</p>
        </Card>
      )}
    </div>
  )
}

const AlertCard: React.FC<{ alert: Alert; onRead: () => void }> = ({ alert, onRead }) => {
  const sev = severityConfig[alert.severity]
  const type = typeConfig[alert.type]

  return (
    <Card className={`${styles.alertCard} ${!alert.isRead ? styles.unread : ''} ${styles[`sev-${alert.severity}`]}`}>
      <div className={styles.alertLeft}>
        <span className={`material-icons-round ${styles.alertIcon} ${styles[alert.severity]}`}>
          {sev.icon}
        </span>
      </div>
      <div className={styles.alertMain}>
        <div className={styles.alertTop}>
          <div className={styles.alertMeta}>
            <Badge variant={sev.variant} size="sm">{sev.label}</Badge>
            <span className={styles.alertType}>
              <span className="material-icons-round">{type.icon}</span>
              {type.label}
            </span>
            {alert.fieldName && (
              <span className={styles.alertField}>
                <span className="material-icons-round">grass</span>
                {alert.fieldName}
              </span>
            )}
          </div>
          <span className={styles.alertTime}>
            {new Date(alert.createdAt).toLocaleString('ru-RU', {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            })}
          </span>
        </div>
        <h3 className={styles.alertTitle}>{alert.title}</h3>
        <p className={styles.alertMessage}>{alert.message}</p>
      </div>
      {!alert.isRead && (
        <button className={styles.readBtn} onClick={onRead} title="Отметить прочитанным">
          <span className="material-icons-round">check</span>
        </button>
      )}
    </Card>
  )
}

export default AlertsPage
