import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@application/store/hooks'
import { fetchFields } from '@application/store/slices/fieldsSlice'
import {
  fetchIrrigationRecommendations,
  fetchIrrigationSchedule,
  fetchIrrigationTasks,
  updateTaskStatus,
} from '@application/store/slices/irrigationSlice'
import { detectFieldAnomalies } from '@application/store/slices/anomalySlice'
import Card from '@presentation/components/common/Card/Card'
import Badge from '@presentation/components/common/Badge/Badge'
import Loader from '@presentation/components/common/Loader/Loader'
import { IrrigationRecommendation, IrrigationTask, IrrigationStatus } from '@domain/entities/Irrigation'
import { AnomalyResult } from '@domain/entities/Anomaly'
import styles from './IrrigationPage.module.scss'

const priorityConfig = {
  critical: { label: 'Критично', variant: 'danger' as const, icon: 'emergency' },
  high:     { label: 'Высокий', variant: 'warning' as const, icon: 'priority_high' },
  medium:   { label: 'Средний', variant: 'info' as const,    icon: 'remove' },
  low:      { label: 'Низкий',  variant: 'success' as const, icon: 'keyboard_arrow_down' },
}

const statusLabels: Record<IrrigationStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  scheduled:  { label: 'Запланировано', variant: 'info' },
  active:     { label: 'Выполняется',   variant: 'warning' },
  completed:  { label: 'Выполнено',     variant: 'success' },
  cancelled:  { label: 'Отменено',      variant: 'danger' },
  skipped:    { label: 'Пропущено',     variant: 'neutral' },
}

const IrrigationPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { items: fields, loading: fieldsLoading } = useAppSelector(s => s.fields)
  const { recommendations, schedules, tasks, tasksLoading } = useAppSelector(s => s.irrigation)
  const anomalyResults = useAppSelector(s => s.anomaly.results)
  const [selectedFieldId, setSelectedFieldId] = useState<string | 'all'>('all')

  useEffect(() => {
    dispatch(fetchFields())
  }, [dispatch])

  useEffect(() => {
    fields.forEach(f => {
      dispatch(fetchIrrigationRecommendations(f.id))
      dispatch(fetchIrrigationSchedule({
        fieldId: f.id,
        cropType: f.cropType,
        currentMoisture: f.currentMoistureLevel,
      }))
      dispatch(fetchIrrigationTasks(f.id))
      dispatch(detectFieldAnomalies({
        fieldId: f.id,
        sensorData: { soilMoisture: f.currentMoistureLevel ?? 60 },
      }))
    })
  }, [fields, dispatch])

  const allRecs = Object.values(recommendations).flat()
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 }
      return order[a.priority] - order[b.priority]
    })

  const filteredRecs = selectedFieldId === 'all'
    ? allRecs
    : allRecs.filter(r => r.fieldId === selectedFieldId)

  const allTasks = Object.values(tasks).flat()
    .filter(t => t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'skipped')
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 }
      return order[a.priority] - order[b.priority]
    })

  const filteredTasks = selectedFieldId === 'all'
    ? allTasks
    : allTasks.filter(t => t.fieldId === selectedFieldId)

  const selectedSchedule = selectedFieldId !== 'all' ? schedules[selectedFieldId] : null

  const totalWater = filteredRecs.reduce((s, r) => s + r.waterAmount, 0)
  const criticalCount = filteredRecs.filter(r => r.priority === 'critical').length
  const highCount = filteredRecs.filter(r => r.priority === 'high').length

  const anomalyFieldIds = Object.entries(anomalyResults)
    .filter(([, r]) => r.hasAnomalies)
    .map(([id]) => id)
  const visibleAnomalyFields = selectedFieldId === 'all'
    ? anomalyFieldIds
    : anomalyFieldIds.filter(id => id === selectedFieldId)

  const handleStatusChange = (task: IrrigationTask, newStatus: IrrigationStatus) => {
    dispatch(updateTaskStatus({ taskId: task.id, fieldId: task.fieldId, status: newStatus }))
  }

  if (fieldsLoading && fields.length === 0) return <Loader text="Загрузка..." fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Управление поливом</h1>
          <p className={styles.subtitle}>Рекомендации на основе ML и задачи сервиса орошения</p>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <Card className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#fce8e6' }}>
            <span className="material-icons-round" style={{ color: '#ea4335' }}>emergency</span>
          </div>
          <div className={styles.statValue}>{criticalCount}</div>
          <div className={styles.statLabel}>Срочных</div>
        </Card>
        <Card className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#fef9e0' }}>
            <span className="material-icons-round" style={{ color: '#f59e0b' }}>priority_high</span>
          </div>
          <div className={styles.statValue}>{highCount}</div>
          <div className={styles.statLabel}>Высокий приоритет</div>
        </Card>
        <Card className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#e8f0fe' }}>
            <span className="material-icons-round" style={{ color: '#1a73e8' }}>water_drop</span>
          </div>
          <div className={styles.statValue}>{totalWater}</div>
          <div className={styles.statLabel}>Итого мм воды</div>
        </Card>
        <Card className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#e6f4ea' }}>
            <span className="material-icons-round" style={{ color: '#34a853' }}>schedule</span>
          </div>
          <div className={styles.statValue}>{allRecs.length}</div>
          <div className={styles.statLabel}>Всего рекомендаций</div>
        </Card>
      </div>

      {/* Field filter */}
      <div className={styles.filterRow}>
        <button
          className={`${styles.filterBtn} ${selectedFieldId === 'all' ? styles.active : ''}`}
          onClick={() => setSelectedFieldId('all')}
        >
          Все поля
        </button>
        {fields.map(f => (
          <button
            key={f.id}
            className={`${styles.filterBtn} ${selectedFieldId === f.id ? styles.active : ''}`}
            onClick={() => setSelectedFieldId(f.id)}
          >
            {f.name}
          </button>
        ))}
      </div>

      {/* Anomaly warnings */}
      {visibleAnomalyFields.length > 0 && (
        <div className={styles.anomalyBanner}>
          <span className="material-icons-round">warning</span>
          <div>
            <strong>Обнаружены аномалии данных датчиков</strong>
            <p>Рекомендации по поливу для следующих полей могут быть неточными — рекомендуется проверить оборудование.</p>
            {visibleAnomalyFields.map(id => {
              const fieldName = fields.find(f => f.id === id)?.name || `Поле ${id}`
              const alerts = anomalyResults[id]?.alerts || []
              return alerts.map((a, i) => (
                <div key={`${id}-${i}`} className={styles.anomalyItem}>
                  <span className="material-icons-round">sensors_off</span>
                  <strong>{fieldName}:</strong> {a.message}
                </div>
              ))
            })}
          </div>
        </div>
      )}

      {/* Irrigation schedule for selected field */}
      {selectedSchedule && selectedSchedule.entries.length > 0 && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className={styles.sectionTitle} style={{ margin: 0 }}>
              <span className="material-icons-round" style={{ verticalAlign: 'middle', marginRight: 6, color: '#1a73e8' }}>event</span>
              Расписание полива — {selectedSchedule.fieldName}
            </h3>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#5f6368' }}>
              <span>
                <span className="material-icons-round" style={{ fontSize: 15, verticalAlign: 'middle', marginRight: 4 }}>water_drop</span>
                Всего: <strong>{selectedSchedule.totalWaterNeeded} мм</strong>
              </span>
              {selectedSchedule.nextIrrigationDate && (
                <span>
                  <span className="material-icons-round" style={{ fontSize: 15, verticalAlign: 'middle', marginRight: 4 }}>calendar_today</span>
                  Следующий: <strong>{new Date(selectedSchedule.nextIrrigationDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</strong>
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedSchedule.entries.map((entry, i) => {
              const cfg = priorityConfig[entry.priority] || priorityConfig.medium
              const statusCfg = statusLabels[entry.status] || statusLabels.scheduled
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  background: '#f8f9fa', borderRadius: 8, flexWrap: 'wrap',
                }}>
                  <span style={{ fontWeight: 600, minWidth: 90, color: '#202124' }}>
                    {new Date(entry.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                  </span>
                  <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  <span style={{ color: '#5f6368', fontSize: 13 }}>
                    <span className="material-icons-round" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 3 }}>water_drop</span>
                    {entry.waterAmount} мм
                  </span>
                  <span style={{ color: '#5f6368', fontSize: 13 }}>
                    <span className="material-icons-round" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 3 }}>timer</span>
                    {entry.duration} мин
                  </span>
                  <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Active tasks from Java irrigation-service */}
      {filteredTasks.length > 0 && (
        <Card>
          <h3 className={styles.sectionTitle}>
            <span className="material-icons-round" style={{ verticalAlign: 'middle', marginRight: 6, color: '#34a853' }}>task_alt</span>
            Задачи орошения {tasksLoading ? '(загрузка…)' : ''}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredTasks.map(task => {
              const cfg = priorityConfig[task.priority] || priorityConfig.medium
              const statusCfg = statusLabels[task.status] || statusLabels.scheduled
              return (
                <div key={task.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  background: '#f8f9fa', borderRadius: 8, flexWrap: 'wrap',
                }}>
                  <div style={{ flexGrow: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 600, color: '#202124', marginBottom: 2 }}>
                      {task.fieldName}
                    </div>
                    <div style={{ fontSize: 12, color: '#5f6368' }}>
                      {new Date(task.scheduledDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {' · '}{task.reason}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                    <span style={{ fontSize: 12, color: '#5f6368' }}>{task.waterAmount} мм / {task.duration} мин</span>
                  </div>
                  {/* Status actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {task.status === 'scheduled' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(task, 'completed')}
                          title="Отметить выполненным"
                          style={{
                            padding: '4px 10px', borderRadius: 6, border: '1px solid #34a853',
                            background: '#e6f4ea', color: '#137333', cursor: 'pointer', fontSize: 12,
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <span className="material-icons-round" style={{ fontSize: 14 }}>check</span>
                          Выполнено
                        </button>
                        <button
                          onClick={() => handleStatusChange(task, 'cancelled')}
                          title="Отменить задачу"
                          style={{
                            padding: '4px 10px', borderRadius: 6, border: '1px solid #ea4335',
                            background: '#fce8e6', color: '#c62828', cursor: 'pointer', fontSize: 12,
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <span className="material-icons-round" style={{ fontSize: 14 }}>close</span>
                          Отменить
                        </button>
                      </>
                    )}
                    {task.status === 'active' && (
                      <button
                        onClick={() => handleStatusChange(task, 'completed')}
                        style={{
                          padding: '4px 10px', borderRadius: 6, border: '1px solid #34a853',
                          background: '#e6f4ea', color: '#137333', cursor: 'pointer', fontSize: 12,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <span className="material-icons-round" style={{ fontSize: 14 }}>check</span>
                        Завершить
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ML Recommendations */}
      <h3 className={styles.sectionTitle} style={{ marginTop: 4 }}>
        <span className="material-icons-round" style={{ verticalAlign: 'middle', marginRight: 6, color: '#1a73e8' }}>psychology</span>
        ML-рекомендации по поливу
      </h3>
      <div className={styles.recsList}>
        {filteredRecs.length === 0 && (
          <Card className={styles.emptyCard}>
            <span className="material-icons-round">check_circle</span>
            <p>Нет рекомендаций для выбранного поля</p>
          </Card>
        )}
        {filteredRecs.map(rec => (
          <IrrigationCard
            key={rec.id}
            rec={rec}
            hasAnomaly={anomalyResults[rec.fieldId]?.hasAnomalies ?? false}
          />
        ))}
      </div>
    </div>
  )
}

const IrrigationCard: React.FC<{ rec: IrrigationRecommendation; hasAnomaly: boolean }> = ({ rec, hasAnomaly }) => {
  const cfg = priorityConfig[rec.priority]

  return (
    <Card className={`${styles.recCard} ${styles[`priority-${rec.priority}`]}`}>
      <div className={styles.recHeader}>
        <div className={styles.recPriority}>
          <Badge variant={cfg.variant} dot>
            <span className="material-icons-round">{cfg.icon}</span>
            {cfg.label}
          </Badge>
          {hasAnomaly && (
            <Badge variant="warning">
              <span className="material-icons-round" style={{ fontSize: 13 }}>sensors_off</span>
              Низкая достоверность
            </Badge>
          )}
        </div>
        <div className={styles.recDate}>
          <span className="material-icons-round">calendar_today</span>
          {new Date(rec.recommendedDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
        </div>
      </div>

      <div className={styles.recBody}>
        <div className={styles.recField}>
          <span className="material-icons-round">grass</span>
          {rec.fieldName}
        </div>
        <p className={styles.recReason}>{rec.reason}</p>
      </div>

      <div className={styles.recStats}>
        <div className={styles.recStat}>
          <span className="material-icons-round">water_drop</span>
          <div>
            <div className={styles.recStatValue}>{rec.waterAmount} мм</div>
            <div className={styles.recStatLabel}>Объём воды</div>
          </div>
        </div>
        <div className={styles.recStat}>
          <span className="material-icons-round">timer</span>
          <div>
            <div className={styles.recStatValue}>{rec.duration} мин</div>
            <div className={styles.recStatLabel}>Длительность</div>
          </div>
        </div>
        <div className={styles.recStat}>
          <span className="material-icons-round">opacity</span>
          <div>
            <div className={styles.recStatValue}>{rec.moistureDeficit}%</div>
            <div className={styles.recStatLabel}>Дефицит влаги</div>
          </div>
        </div>
        <div className={styles.recStat}>
          <span className="material-icons-round">psychology</span>
          <div>
            <div className={styles.recStatValue}>{rec.confidence}%</div>
            <div className={styles.recStatLabel}>Уверенность</div>
          </div>
        </div>
      </div>

      {/* Moisture bar */}
      <div className={styles.moistureBar}>
        <div className={styles.moistureBarLabel}>
          <span>Текущая влажность почвы</span>
          <span>{100 - rec.moistureDeficit}%</span>
        </div>
        <div className={styles.moistureBarTrack}>
          <div
            className={styles.moistureBarFill}
            style={{
              width: `${100 - rec.moistureDeficit}%`,
              background: rec.moistureDeficit > 25 ? '#ea4335' : rec.moistureDeficit > 15 ? '#fbbc04' : '#34a853',
            }}
          />
          <div className={styles.moistureBarOptimal} style={{ left: '60%' }} title="Оптимальный уровень" />
        </div>
      </div>
    </Card>
  )
}

export default IrrigationPage
