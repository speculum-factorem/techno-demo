import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@application/store/hooks'
import { fetchFields } from '@application/store/slices/fieldsSlice'
import { satelliteApi, SatelliteGridResponse, SatelliteSeriesPoint } from '@infrastructure/api/SatelliteApi'
import Loader from '@presentation/components/common/Loader/Loader'
import styles from './SatelliteAnalyticsPage.module.scss'

const ndviColor = (v: number) => {
  if (v >= 0.7) return '#1a7a1a'
  if (v >= 0.55) return '#4caf50'
  if (v >= 0.4) return '#cddc39'
  if (v >= 0.25) return '#ffeb3b'
  return '#f44336'
}

const ndmiColor = (v: number) => {
  if (v >= 0.45) return '#0d47a1'
  if (v >= 0.3) return '#1976d2'
  if (v >= 0.15) return '#64b5f6'
  if (v >= 0) return '#bbdefb'
  return '#ef9a9a'
}

const SatelliteGridView: React.FC<{
  cells: (number | null)[][]
  mode: 'ndvi' | 'ndmi'
}> = ({ cells, mode }) => {
  const colorFn = mode === 'ndvi' ? ndviColor : ndmiColor
  const flat = cells.flat()
  return (
    <div className={styles.mapGrid}>
      {flat.map((v, i) => (
        <div
          key={i}
          className={styles.mapCell}
          style={{
            background: v == null || Number.isNaN(v) ? '#3d3d54' : colorFn(v),
          }}
          title={v == null ? 'Нет данных' : `${mode.toUpperCase()}: ${v.toFixed(3)}`}
        />
      ))}
    </div>
  )
}

const trendFromSeries = (points: SatelliteSeriesPoint[], mode: 'ndvi' | 'ndmi'): 'up' | 'down' | 'stable' => {
  if (points.length < 2) return 'stable'
  const asc = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const a = mode === 'ndvi' ? asc[0].ndvi : asc[0].ndmi
  const b = mode === 'ndvi' ? asc[asc.length - 1].ndvi : asc[asc.length - 1].ndmi
  if (b - a > 0.03) return 'up'
  if (a - b > 0.03) return 'down'
  return 'stable'
}

const SatelliteAnalyticsPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { items: fields, loading: fieldsLoading } = useAppSelector(s => s.fields)
  const [fieldId, setFieldId] = useState('')
  const [dates, setDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [series, setSeries] = useState<SatelliteSeriesPoint[]>([])
  const [grid, setGrid] = useState<SatelliteGridResponse | null>(null)
  const [mapMode, setMapMode] = useState<'ndvi' | 'ndmi'>('ndvi')
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [loadingGrid, setLoadingGrid] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gridError, setGridError] = useState<string | null>(null)

  useEffect(() => {
    dispatch(fetchFields())
  }, [dispatch])

  useEffect(() => {
    if (!fields.length) return
    if (!fieldId || !fields.some(f => f.id === fieldId)) {
      setFieldId(fields[0].id)
    }
  }, [fields, fieldId])

  useEffect(() => {
    if (!fieldId) return
    setLoadingMeta(true)
    setError(null)
    setGrid(null)
    setDates([])
    setSelectedDate('')
    setSeries([])
    Promise.all([satelliteApi.getDates(fieldId, 150), satelliteApi.getSeries(fieldId, 150, 10)])
      .then(([d, s]) => {
        setDates(d.dates)
        setSeries(s.points)
        const first = d.dates[0]
        setSelectedDate(first || '')
      })
      .catch((e: { response?: { data?: { detail?: string } }; message?: string }) => {
        setError(e.response?.data?.detail || e.message || 'Не удалось загрузить спутниковые метаданные')
      })
      .finally(() => setLoadingMeta(false))
  }, [fieldId])

  useEffect(() => {
    if (!fieldId || !selectedDate) {
      setGrid(null)
      return
    }
    setLoadingGrid(true)
    setGridError(null)
    satelliteApi
      .getGrid(fieldId, selectedDate, mapMode, 12, 8)
      .then(setGrid)
      .catch((e: { response?: { data?: { detail?: string } }; message?: string }) => {
        setGrid(null)
        setGridError(e.response?.data?.detail || e.message || 'Не удалось загрузить сетку')
      })
      .finally(() => setLoadingGrid(false))
  }, [fieldId, selectedDate, mapMode])

  const field = useMemo(() => fields.find(f => f.id === fieldId), [fields, fieldId])

  const stats = grid?.stats
  const meanNdvi = stats?.meanNdvi
  const meanNdmi = stats?.meanNdmi

  const alerts = useMemo(() => {
    const out: { msg: string; color: string }[] = []
    if (meanNdvi != null && meanNdvi < 0.35) {
      out.push({ msg: `Низкая вегетация по снимку (${meanNdvi.toFixed(2)}), возможен стресс`, color: '#f9ab00' })
    }
    if (meanNdmi != null && meanNdmi < 0.12) {
      out.push({ msg: `Признаки дефицита влаги по снимку (${meanNdmi.toFixed(2)})`, color: '#ea4335' })
    }
    if (stats && stats.stressLowVegetationPercent > 25) {
      out.push({
        msg: `Низкая вегетация на ${stats.stressLowVegetationPercent}% пикселей сцены`,
        color: '#ea4335',
      })
    }
    return out
  }, [meanNdvi, meanNdmi, stats])

  const trend = trendFromSeries(series, mapMode)
  const trendIcon = { up: 'trending_up', down: 'trending_down', stable: 'trending_flat' }[trend]
  const trendColor = { up: '#34a853', down: '#ea4335', stable: '#f9ab00' }[trend]

  const legendNdvi = [
    { color: '#1a7a1a', label: '≥ 0.7 Высокая' },
    { color: '#4caf50', label: '0.55–0.7 Хорошая' },
    { color: '#cddc39', label: '0.4–0.55 Средняя' },
    { color: '#ffeb3b', label: '0.25–0.4 Низкая' },
    { color: '#f44336', label: '< 0.25 Стресс' },
  ]
  const legendNdmi = [
    { color: '#0d47a1', label: '≥ 0.45 Насыщено' },
    { color: '#1976d2', label: '0.3–0.45 Высокая' },
    { color: '#64b5f6', label: '0.15–0.3 Нормальная' },
    { color: '#bbdefb', label: '0–0.15 Низкая' },
    { color: '#ef9a9a', label: '< 0 Дефицит' },
  ]

  const historyBars = useMemo(() => {
    const sorted = [...series].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).reverse()
    return sorted
  }, [series])

  if (fieldsLoading && !fields.length) {
    return <Loader text="Загрузка полей..." fullPage />
  }

  if (!fields.length) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>
              <span className="material-icons-round">satellite_alt</span> Спутниковая аналитика
            </h1>
            <p className={styles.sub}>Нет полей — добавьте поле с координатами, чтобы открыть спутниковые слои.</p>
          </div>
        </div>
        <Link to="/app/fields" className={styles.exportBtn} style={{ display: 'inline-flex', textDecoration: 'none' }}>
          <span className="material-icons-round">add</span> К полям
        </Link>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <span className="material-icons-round">satellite_alt</span> Спутниковая аналитика
          </h1>
          <p className={styles.sub}>
            Вегетация и влажность почвы по спутниковым снимкам. Для загрузки снимков нужна сеть у сервера расчётов.
          </p>
          {grid?.source && (
            <p className={styles.sub} style={{ marginTop: 6, fontSize: '0.8rem' }}>
              Сцена: {grid.sceneDatetime || selectedDate}
              {grid.cloudCover != null ? ` · облачность ~${grid.cloudCover}%` : ''}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className={styles.alertsBanner}>
          <div className={styles.alertItem} style={{ borderLeftColor: '#ea4335' }}>
            <span className="material-icons-round" style={{ color: '#ea4335', fontSize: 16 }}>error</span>
            {error}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <label>Поле</label>
          <select
            className={styles.select}
            value={fieldId}
            onChange={e => setFieldId(e.target.value)}
            disabled={loadingMeta}
          >
            {fields.map(f => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.area} га)
              </option>
            ))}
          </select>
        </div>
        <div className={styles.controlGroup}>
          <label>Дата снимка</label>
          <select
            className={styles.select}
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            disabled={loadingMeta || !dates.length}
          >
            {!dates.length && <option value="">Нет сцен в окне — см. подсказку ниже</option>}
            {dates.map(d => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.modeBtns}>
          <button
            type="button"
            className={`${styles.modeBtn} ${mapMode === 'ndvi' ? styles.activeModeBtn : ''}`}
            onClick={() => setMapMode('ndvi')}
          >
            <span className="material-icons-round">eco</span> NDVI
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mapMode === 'ndmi' ? styles.activeModeBtn : ''}`}
            onClick={() => setMapMode('ndmi')}
          >
            <span className="material-icons-round">water</span> NDMI
          </button>
        </div>
      </div>

      {!loadingMeta && !dates.length && !error && (
        <p className={styles.sub} style={{ marginBottom: 12 }}>
          За последние несколько месяцев нет подходящих снимков (много облаков). Проверьте координаты поля или попробуйте позже.
        </p>
      )}

      {loadingMeta && <Loader text="Загрузка снимков…" />}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className={styles.alertsBanner}>
          {alerts.map((a, i) => (
            <div key={i} className={styles.alertItem} style={{ borderLeft: `3px solid ${a.color}` }}>
              <span className="material-icons-round" style={{ color: a.color, fontSize: 16 }}>warning</span>
              {a.msg}
            </div>
          ))}
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.mapCard}>
          <div className={styles.mapHeader}>
            <span className={styles.mapTitle}>
              {field?.name ?? 'Поле'} — {mapMode.toUpperCase()}
            </span>
            <span className={styles.mapDate}>{selectedDate || '—'}</span>
          </div>
          {gridError && (
            <div style={{ padding: 12, color: '#c5221f', fontSize: '0.88rem' }}>{gridError}</div>
          )}
          {loadingGrid && <Loader text="Загрузка растра…" />}
          {!loadingGrid && grid?.cells?.length ? (
            <SatelliteGridView cells={grid.cells} mode={mapMode} />
          ) : !loadingGrid && selectedDate && !gridError ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#5f6368' }}>Нет данных сетки</div>
          ) : null}
          <div className={styles.legend}>
            {(mapMode === 'ndvi' ? legendNdvi : legendNdmi).map(l => (
              <div key={l.label} className={styles.legendItem}>
                <div className={styles.legendColor} style={{ background: l.color }} />
                <span>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.statsPanel}>
          <div className={styles.indexCard}>
            <div className={styles.indexLabel}>NDVI</div>
            <div className={styles.indexValue} style={{ color: meanNdvi != null ? ndviColor(meanNdvi) : '#9aa0a6' }}>
              {meanNdvi != null ? meanNdvi.toFixed(2) : '—'}
            </div>
            <div className={styles.indexBar}>
              {meanNdvi != null && (
                <div
                  className={styles.indexFill}
                  style={{ width: `${Math.min(100, Math.max(0, meanNdvi * 100))}%`, background: ndviColor(meanNdvi) }}
                />
              )}
            </div>
            <div className={styles.indexSub}>Среднее по выбранному снимку</div>
          </div>
          <div className={styles.indexCard}>
            <div className={styles.indexLabel}>NDMI</div>
            <div className={styles.indexValue} style={{ color: meanNdmi != null ? ndmiColor(meanNdmi) : '#9aa0a6' }}>
              {meanNdmi != null ? meanNdmi.toFixed(2) : '—'}
            </div>
            <div className={styles.indexBar}>
              {meanNdmi != null && (
                <div
                  className={styles.indexFill}
                  style={{
                    width: `${Math.min(100, Math.max(0, (meanNdmi + 0.2) * 120))}%`,
                    background: ndmiColor(meanNdmi),
                  }}
                />
              )}
            </div>
            <div className={styles.indexSub}>Среднее по выбранному снимку</div>
          </div>

          <div className={styles.detailCard}>
            <div className={styles.detailRow}>
              <span className="material-icons-round" style={{ fontSize: 18, color: '#34a853' }}>spa</span>
              <span>Доля валидных пикселей</span>
              <strong>{stats?.coverageGoodPercent != null ? `${stats.coverageGoodPercent}%` : '—'}</strong>
            </div>
            <div className={styles.detailRow}>
              <span className="material-icons-round" style={{ fontSize: 18, color: '#ea4335' }}>report_problem</span>
              <span>Низкая вегетация</span>
              <strong style={{ color: (stats?.stressLowVegetationPercent ?? 0) > 20 ? '#ea4335' : '#f9ab00' }}>
                {stats?.stressLowVegetationPercent != null ? `${stats.stressLowVegetationPercent}%` : '—'}
              </strong>
            </div>
            <div className={styles.detailRow}>
              <span className="material-icons-round" style={{ fontSize: 18, color: trendColor }}>{trendIcon}</span>
              <span>Тренд по ряду сцен</span>
              <strong style={{ color: trendColor }}>
                {trend === 'up' ? 'Рост' : trend === 'down' ? 'Спад' : 'Стабильно'}
              </strong>
            </div>
            <div className={styles.detailRow}>
              <span className="material-icons-round" style={{ fontSize: 18, color: '#1a73e8' }}>straighten</span>
              <span>Площадь</span>
              <strong>{field?.area != null ? `${field.area} га` : '—'}</strong>
            </div>
          </div>

          <div className={styles.historyCard}>
            <div className={styles.historyTitle}>История {mapMode.toUpperCase()} (последние сцены)</div>
            <div className={styles.historyChart}>
              {historyBars.length ? (
                historyBars.map(p => {
                  const v = mapMode === 'ndvi' ? p.ndvi : p.ndmi
                  const h = mapMode === 'ndvi' ? Math.min(100, Math.max(4, v * 100)) : Math.min(100, Math.max(4, (v + 0.2) * 130))
                  return (
                    <div key={p.date} className={styles.histBar}>
                      <div
                        className={styles.histBarFill}
                        style={{ height: `${h}%`, background: mapMode === 'ndvi' ? ndviColor(v) : ndmiColor(v) }}
                      />
                      <span className={styles.histLabel}>{p.date.slice(5)}</span>
                    </div>
                  )
                })
              ) : (
                <span className={styles.histLabel}>Нет ряда</span>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default SatelliteAnalyticsPage
