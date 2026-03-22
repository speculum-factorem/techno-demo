import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@application/store/hooks'
import { fetchFields } from '@application/store/slices/fieldsSlice'
import { fetchAlerts } from '@application/store/slices/alertsSlice'
import { fetchWeatherSummary } from '@application/store/slices/weatherSlice'
import { fetchYieldForecastsByField } from '@application/store/slices/forecastSlice'
import { fetchIrrigationRecommendations } from '@application/store/slices/irrigationSlice'
import Card from '@presentation/components/common/Card/Card'
import Badge from '@presentation/components/common/Badge/Badge'
import Loader from '@presentation/components/common/Loader/Loader'
import styles from './Dashboard.module.scss'

const cropLabels: Record<string, string> = {
  wheat: 'Пшеница', corn: 'Кукуруза', sunflower: 'Подсолнечник',
  barley: 'Ячмень', soy: 'Соя', sugar_beet: 'Сахарная свёкла', other: 'Другая',
}

const statusLabels: Record<string, string> = {
  active: 'Активно', idle: 'Простой', harvested: 'Убрано', preparing: 'Подготовка',
}

const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { items: fields, loading } = useAppSelector(s => s.fields)
  const { items: alerts } = useAppSelector(s => s.alerts)
  const { summaries } = useAppSelector(s => s.weather)
  const { forecasts } = useAppSelector(s => s.forecast)
  const { recommendations } = useAppSelector(s => s.irrigation)

  useEffect(() => {
    dispatch(fetchFields())
    dispatch(fetchAlerts())
  }, [dispatch])

  useEffect(() => {
    if (fields.length > 0) {
      fields.forEach(f => {
        dispatch(fetchWeatherSummary(f.id))
        dispatch(fetchYieldForecastsByField(f.id))
        dispatch(fetchIrrigationRecommendations(f.id))
      })
    }
  }, [fields, dispatch])

  const totalArea = fields.reduce((sum, f) => sum + f.area, 0)
  const activeFields = fields.filter(f => f.status === 'active').length
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.isRead).length
  const unreadAlerts = alerts.filter(a => !a.isRead).length

  const allRecommendations = Object.values(recommendations).flat()
  const criticalIrrigation = allRecommendations.filter(r => r.priority === 'critical').length

  if (loading && fields.length === 0) {
    return <Loader text="Загрузка данных..." fullPage />
  }

  const avgTemp = fields.length > 0 && summaries[fields[0]?.id]
    ? Math.round(summaries[fields[0].id].current.temperature)
    : null

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Дашборд</h1>
          <p className={styles.subtitle}>Предиктивная аналитика для сельского хозяйства</p>
        </div>
        <div className={styles.date}>
          {new Date().toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <Card className={styles.kpiCard} hoverable onClick={() => navigate('/app/fields')}>
          <div className={styles.kpiIcon} style={{ background: '#e8f0fe' }}>
            <span className="material-icons-round" style={{ color: '#1a73e8' }}>grass</span>
          </div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiValue}>{fields.length}</div>
            <div className={styles.kpiLabel}>Всего полей</div>
            <div className={styles.kpiSub}>{totalArea.toFixed(1)} га общая площадь</div>
          </div>
        </Card>

        <Card className={styles.kpiCard} hoverable onClick={() => navigate('/app/fields')}>
          <div className={styles.kpiIcon} style={{ background: '#e6f4ea' }}>
            <span className="material-icons-round" style={{ color: '#34a853' }}>agriculture</span>
          </div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiValue}>{activeFields}</div>
            <div className={styles.kpiLabel}>Активных полей</div>
            <div className={styles.kpiSub}>{fields.length - activeFields} в простое или уборке</div>
          </div>
        </Card>

        <Card className={`${styles.kpiCard} ${criticalAlerts > 0 ? styles.kpiCardDanger : ''}`}
          hoverable onClick={() => navigate('/app/alerts')}>
          <div className={styles.kpiIcon} style={{ background: criticalAlerts > 0 ? '#fce8e6' : '#f8f9fa' }}>
            <span className="material-icons-round"
              style={{ color: criticalAlerts > 0 ? '#ea4335' : '#5f6368' }}>
              notifications
            </span>
          </div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiValue} style={{ color: criticalAlerts > 0 ? '#ea4335' : undefined }}>
              {unreadAlerts}
            </div>
            <div className={styles.kpiLabel}>Новых уведомлений</div>
            <div className={styles.kpiSub}>{criticalAlerts > 0 ? `${criticalAlerts} критических` : 'Без критических'}</div>
          </div>
        </Card>

        <Card className={`${styles.kpiCard} ${criticalIrrigation > 0 ? styles.kpiCardWarning : ''}`}
          hoverable onClick={() => navigate('/app/irrigation')}>
          <div className={styles.kpiIcon} style={{ background: criticalIrrigation > 0 ? '#fff8e1' : '#e8f0fe' }}>
            <span className="material-icons-round"
              style={{ color: criticalIrrigation > 0 ? '#f59e0b' : '#1a73e8' }}>
              water_drop
            </span>
          </div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiValue}>{allRecommendations.length}</div>
            <div className={styles.kpiLabel}>Рекомендаций полива</div>
            <div className={styles.kpiSub}>{criticalIrrigation > 0 ? `${criticalIrrigation} срочных` : 'Всё в норме'}</div>
          </div>
        </Card>
      </div>

      {/* Main content grid */}
      <div className={styles.mainGrid}>
        {/* Fields overview */}
        <Card padding="none" className={styles.fieldsCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              <span className="material-icons-round">grass</span>
              Состояние полей
            </h2>
            <button className={styles.cardAction} onClick={() => navigate('/app/fields')}>
              Все поля <span className="material-icons-round">arrow_forward</span>
            </button>
          </div>
          <div className={styles.fieldsList}>
            {fields.length === 0 ? (
              <div className={styles.fieldsEmpty}>
                <div className={styles.fieldsEmptyIcon}>
                  <span className="material-icons-round">grass</span>
                </div>
                <p className={styles.fieldsEmptyTitle}>У вас пока нет полей</p>
                <p className={styles.fieldsEmptyHint}>
                  Добавьте поле в разделе «Поля», чтобы здесь отображались культура, влажность и прогнозы.
                </p>
                <button type="button" className={styles.fieldsEmptyCta} onClick={() => navigate('/app/fields')}>
                  Перейти к полям
                </button>
              </div>
            ) : (
              fields.map(field => {
                const summary = summaries[field.id]
                const forecast = forecasts[field.id]?.[0]
                const irrigation = recommendations[field.id]?.[0]
                return (
                  <div key={field.id} className={styles.fieldRow}
                    onClick={() => navigate('/app/fields')}>
                    <div className={styles.fieldInfo}>
                      <div className={styles.fieldName}>{field.name}</div>
                      <div className={styles.fieldMeta}>
                        {cropLabels[field.cropType]} · {field.area} га · {field.soilType}
                      </div>
                    </div>
                    <div className={styles.fieldStats}>
                      {field.currentMoistureLevel != null && (
                        <div className={`${styles.statItem} ${field.currentMoistureLevel < 40 ? styles.statDanger : field.currentMoistureLevel < 55 ? styles.statWarning : ''}`}>
                          <span className="material-icons-round">water</span>
                          {field.currentMoistureLevel}%
                        </div>
                      )}
                      {summary && (
                        <div className={styles.statItem}>
                          <span className="material-icons-round">thermostat</span>
                          {summary.current.temperature.toFixed(1)}°C
                        </div>
                      )}
                      {forecast && (
                        <div className={styles.statItem}>
                          <span className="material-icons-round">trending_up</span>
                          {forecast.predictedYield} т/га
                        </div>
                      )}
                      <Badge
                        variant={field.status === 'active' ? 'success' : field.status === 'idle' ? 'neutral' : 'info'}
                        size="sm"
                      >
                        {statusLabels[field.status]}
                      </Badge>
                      {irrigation && irrigation.priority === 'critical' && (
                        <Badge variant="danger" size="sm" dot>Полив!</Badge>
                      )}
                      {irrigation && irrigation.priority === 'high' && (
                        <Badge variant="warning" size="sm" dot>Полив</Badge>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>

        {/* Alerts sidebar */}
        <div className={styles.sideColumn}>
          <Card padding="none" className={styles.alertsCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <span className="material-icons-round">notifications_active</span>
                Уведомления
              </h2>
              <button className={styles.cardAction} onClick={() => navigate('/app/alerts')}>
                Все <span className="material-icons-round">arrow_forward</span>
              </button>
            </div>
            <div className={styles.alertsList}>
              {alerts.slice(0, 4).map(alert => (
                <div key={alert.id} className={`${styles.alertRow} ${!alert.isRead ? styles.unread : ''}`}>
                  <span className={`material-icons-round ${styles.alertIcon} ${styles[`severity-${alert.severity}`]}`}>
                    {alert.severity === 'critical' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info'}
                  </span>
                  <div className={styles.alertContent}>
                    <div className={styles.alertTitle}>{alert.title}</div>
                    <div className={styles.alertTime}>
                      {new Date(alert.createdAt).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                    </div>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <div className={styles.emptyState}>
                  <span className="material-icons-round">check_circle</span>
                  <p>Нет новых уведомлений</p>
                </div>
              )}
            </div>
          </Card>

          {/* Weather snapshot */}
          {fields[0] && summaries[fields[0].id] && (
            <Card padding="md" hoverable onClick={() => navigate('/app/weather')}>
              <div className={styles.weatherSnap}>
                <div className={styles.weatherSnapHeader}>
                  <span className="material-icons-round">cloud</span>
                  <span>Текущая погода</span>
                </div>
                <div className={styles.weatherSnapTemp}>
                  {summaries[fields[0].id].current.temperature.toFixed(1)}°C
                </div>
                <div className={styles.weatherSnapStats}>
                  <span><span className="material-icons-round">water_drop</span>{summaries[fields[0].id].current.humidity.toFixed(0)}%</span>
                  <span><span className="material-icons-round">air</span>{summaries[fields[0].id].current.windSpeed.toFixed(1)} м/с</span>
                  <span><span className="material-icons-round">compress</span>{summaries[fields[0].id].current.pressure.toFixed(0)} гПа</span>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
