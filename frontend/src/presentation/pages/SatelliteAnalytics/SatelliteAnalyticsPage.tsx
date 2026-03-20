import React, { useState } from 'react'
import styles from './SatelliteAnalyticsPage.module.scss'

const FIELDS = [
  { id: 'f1', name: 'Поле А-1 (Пшеница)', area: 45.2 },
  { id: 'f2', name: 'Поле Б-2 (Кукуруза)', area: 38.7 },
  { id: 'f3', name: 'Поле В-3 (Подсолнечник)', area: 29.1 },
  { id: 'f4', name: 'Поле Г-4 (Ячмень)', area: 52.3 },
]

const DATES = ['2026-03-20', '2026-03-15', '2026-03-10', '2026-02-28', '2026-02-15']

interface FieldIndex {
  ndvi: number
  ndmi: number
  coverage: number
  stressZone: number
  trend: 'up' | 'down' | 'stable'
}

const FIELD_INDICES: Record<string, FieldIndex> = {
  f1: { ndvi: 0.72, ndmi: 0.41, coverage: 94, stressZone: 8, trend: 'up' },
  f2: { ndvi: 0.58, ndmi: 0.29, coverage: 87, stressZone: 22, trend: 'down' },
  f3: { ndvi: 0.65, ndmi: 0.35, coverage: 91, stressZone: 12, trend: 'stable' },
  f4: { ndvi: 0.48, ndmi: 0.19, coverage: 78, stressZone: 35, trend: 'down' },
}

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

const NdviMapMock: React.FC<{ fieldId: string; mode: 'ndvi' | 'ndmi' }> = ({ fieldId, mode }) => {
  const base = mode === 'ndvi' ? FIELD_INDICES[fieldId].ndvi : FIELD_INDICES[fieldId].ndmi
  const colorFn = mode === 'ndvi' ? ndviColor : ndmiColor
  const cells = Array.from({ length: 12 * 8 }, (_, i) => {
    const noise = (Math.sin(i * 3.14 + fieldId.charCodeAt(1)) * 0.12) + (Math.cos(i * 1.7) * 0.08)
    return Math.max(0, Math.min(1, base + noise))
  })
  return (
    <div className={styles.mapGrid}>
      {cells.map((v, i) => (
        <div key={i} className={styles.mapCell} style={{ background: colorFn(v) }} title={`${mode.toUpperCase()}: ${v.toFixed(2)}`} />
      ))}
    </div>
  )
}

const SatelliteAnalyticsPage: React.FC = () => {
  const [selectedField, setSelectedField] = useState(FIELDS[0])
  const [selectedDate, setSelectedDate] = useState(DATES[0])
  const [mapMode, setMapMode] = useState<'ndvi' | 'ndmi'>('ndvi')

  const idx = FIELD_INDICES[selectedField.id]
  const alerts = []
  if (idx.ndvi < 0.5) alerts.push({ msg: `NDVI ${idx.ndvi.toFixed(2)} — низкая вегетация, возможен стресс`, color: '#f9ab00' })
  if (idx.ndmi < 0.25) alerts.push({ msg: `NDMI ${idx.ndmi.toFixed(2)} — дефицит влаги`, color: '#ea4335' })
  if (idx.stressZone > 20) alerts.push({ msg: `Зоны стресса: ${idx.stressZone}% площади — требуется инспекция`, color: '#ea4335' })

  const trendIcon = { up: 'trending_up', down: 'trending_down', stable: 'trending_flat' }[idx.trend]
  const trendColor = { up: '#34a853', down: '#ea4335', stable: '#f9ab00' }[idx.trend]

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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}><span className="material-icons-round">satellite_alt</span> Спутниковая аналитика</h1>
          <p className={styles.sub}>Индексы NDVI и NDMI — состояние вегетации и водный стресс</p>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <label>Поле</label>
          <select className={styles.select} value={selectedField.id} onChange={e => setSelectedField(FIELDS.find(f => f.id === e.target.value)!)}>
            {FIELDS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className={styles.controlGroup}>
          <label>Дата снимка</label>
          <select className={styles.select} value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>
            {DATES.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className={styles.modeBtns}>
          <button className={`${styles.modeBtn} ${mapMode === 'ndvi' ? styles.activeModeBtn : ''}`} onClick={() => setMapMode('ndvi')}>
            <span className="material-icons-round">eco</span> NDVI
          </button>
          <button className={`${styles.modeBtn} ${mapMode === 'ndmi' ? styles.activeModeBtn : ''}`} onClick={() => setMapMode('ndmi')}>
            <span className="material-icons-round">water</span> NDMI
          </button>
        </div>
      </div>

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
        {/* Map area */}
        <div className={styles.mapCard}>
          <div className={styles.mapHeader}>
            <span className={styles.mapTitle}>{selectedField.name} — {mapMode.toUpperCase()}</span>
            <span className={styles.mapDate}>{selectedDate}</span>
          </div>
          <NdviMapMock fieldId={selectedField.id} mode={mapMode} />
          <div className={styles.legend}>
            {(mapMode === 'ndvi' ? legendNdvi : legendNdmi).map(l => (
              <div key={l.label} className={styles.legendItem}>
                <div className={styles.legendColor} style={{ background: l.color }} />
                <span>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats panel */}
        <div className={styles.statsPanel}>
          <div className={styles.indexCard}>
            <div className={styles.indexLabel}>NDVI</div>
            <div className={styles.indexValue} style={{ color: ndviColor(idx.ndvi) }}>{idx.ndvi.toFixed(2)}</div>
            <div className={styles.indexBar}>
              <div className={styles.indexFill} style={{ width: `${idx.ndvi * 100}%`, background: ndviColor(idx.ndvi) }} />
            </div>
            <div className={styles.indexSub}>Индекс вегетации</div>
          </div>
          <div className={styles.indexCard}>
            <div className={styles.indexLabel}>NDMI</div>
            <div className={styles.indexValue} style={{ color: ndmiColor(idx.ndmi) }}>{idx.ndmi.toFixed(2)}</div>
            <div className={styles.indexBar}>
              <div className={styles.indexFill} style={{ width: `${Math.max(0, idx.ndmi) * 100}%`, background: ndmiColor(idx.ndmi) }} />
            </div>
            <div className={styles.indexSub}>Индекс влажности</div>
          </div>

          <div className={styles.detailCard}>
            <div className={styles.detailRow}>
              <span className="material-icons-round" style={{ fontSize: 18, color: '#34a853' }}>spa</span>
              <span>Покрытие</span>
              <strong>{idx.coverage}%</strong>
            </div>
            <div className={styles.detailRow}>
              <span className="material-icons-round" style={{ fontSize: 18, color: '#ea4335' }}>report_problem</span>
              <span>Зоны стресса</span>
              <strong style={{ color: idx.stressZone > 20 ? '#ea4335' : '#f9ab00' }}>{idx.stressZone}%</strong>
            </div>
            <div className={styles.detailRow}>
              <span className="material-icons-round" style={{ fontSize: 18, color: trendColor }}>{trendIcon}</span>
              <span>Тренд</span>
              <strong style={{ color: trendColor }}>{idx.trend === 'up' ? 'Рост' : idx.trend === 'down' ? 'Спад' : 'Стабильно'}</strong>
            </div>
            <div className={styles.detailRow}>
              <span className="material-icons-round" style={{ fontSize: 18, color: '#1a73e8' }}>straighten</span>
              <span>Площадь</span>
              <strong>{selectedField.area} га</strong>
            </div>
          </div>

          {/* Time series mini chart */}
          <div className={styles.historyCard}>
            <div className={styles.historyTitle}>История {mapMode.toUpperCase()}</div>
            <div className={styles.historyChart}>
              {[0.61, 0.58, 0.65, 0.70, 0.72].map((v, i) => (
                <div key={i} className={styles.histBar}>
                  <div className={styles.histBarFill} style={{ height: `${v * 100}%`, background: ndviColor(v) }} />
                  <span className={styles.histLabel}>{DATES[DATES.length - 1 - i].slice(5)}</span>
                </div>
              ))}
            </div>
          </div>

          <button className={styles.exportBtn}>
            <span className="material-icons-round">download</span>
            Скачать GeoTIFF
          </button>
        </div>
      </div>
    </div>
  )
}

export default SatelliteAnalyticsPage
