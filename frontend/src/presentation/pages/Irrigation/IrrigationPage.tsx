import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@application/store/hooks'
import { fetchFields } from '@application/store/slices/fieldsSlice'
import { fetchIrrigationRecommendations } from '@application/store/slices/irrigationSlice'
import Card from '@presentation/components/common/Card/Card'
import Badge from '@presentation/components/common/Badge/Badge'
import Loader from '@presentation/components/common/Loader/Loader'
import { IrrigationRecommendation } from '@domain/entities/Irrigation'
import styles from './IrrigationPage.module.scss'

const priorityConfig = {
  critical: { label: 'Критично', variant: 'danger' as const, icon: 'emergency' },
  high: { label: 'Высокий', variant: 'warning' as const, icon: 'priority_high' },
  medium: { label: 'Средний', variant: 'info' as const, icon: 'remove' },
  low: { label: 'Низкий', variant: 'success' as const, icon: 'keyboard_arrow_down' },
}

const IrrigationPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { items: fields, loading: fieldsLoading } = useAppSelector(s => s.fields)
  const { recommendations } = useAppSelector(s => s.irrigation)
  const [selectedFieldId, setSelectedFieldId] = useState<string | 'all'>('all')

  useEffect(() => {
    dispatch(fetchFields())
  }, [dispatch])

  useEffect(() => {
    fields.forEach(f => dispatch(fetchIrrigationRecommendations(f.id)))
  }, [fields, dispatch])

  const allRecs = Object.values(recommendations).flat()
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 }
      return order[a.priority] - order[b.priority]
    })

  const filteredRecs = selectedFieldId === 'all'
    ? allRecs
    : allRecs.filter(r => r.fieldId === selectedFieldId)

  const totalWater = filteredRecs.reduce((s, r) => s + r.waterAmount, 0)
  const criticalCount = filteredRecs.filter(r => r.priority === 'critical').length
  const highCount = filteredRecs.filter(r => r.priority === 'high').length

  if (fieldsLoading && fields.length === 0) return <Loader text="Загрузка..." fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Рекомендации по поливу</h1>
          <p className={styles.subtitle}>На основе данных влажности почвы и метеопрогноза</p>
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

      {/* Filter */}
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

      {/* Recommendations */}
      <div className={styles.recsList}>
        {filteredRecs.length === 0 && (
          <Card className={styles.emptyCard}>
            <span className="material-icons-round">check_circle</span>
            <p>Нет рекомендаций для выбранного поля</p>
          </Card>
        )}
        {filteredRecs.map(rec => (
          <IrrigationCard key={rec.id} rec={rec} />
        ))}
      </div>
    </div>
  )
}

const IrrigationCard: React.FC<{ rec: IrrigationRecommendation }> = ({ rec }) => {
  const cfg = priorityConfig[rec.priority]

  return (
    <Card className={`${styles.recCard} ${styles[`priority-${rec.priority}`]}`}>
      <div className={styles.recHeader}>
        <div className={styles.recPriority}>
          <Badge variant={cfg.variant} dot>
            <span className="material-icons-round">{cfg.icon}</span>
            {cfg.label}
          </Badge>
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
