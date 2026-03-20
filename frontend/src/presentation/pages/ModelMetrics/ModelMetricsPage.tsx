import React, { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@application/store/hooks'
import { fetchModelMetrics } from '@application/store/slices/anomalySlice'
import Card from '@presentation/components/common/Card/Card'
import Badge from '@presentation/components/common/Badge/Badge'
import Loader from '@presentation/components/common/Loader/Loader'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from 'recharts'
import styles from './ModelMetricsPage.module.scss'

const CROP_LABELS: Record<string, string> = {
  wheat: 'Пшеница', corn: 'Кукуруза', sunflower: 'Подсолнечник',
  barley: 'Ячмень', soy: 'Соя', sugar_beet: 'Сах. свёкла', other: 'Другие',
}

const ModelMetricsPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { metrics, loadingMetrics } = useAppSelector(s => s.anomaly)

  useEffect(() => {
    dispatch(fetchModelMetrics())
  }, [dispatch])

  if (loadingMetrics && !metrics) return <Loader text="Расчёт метрик модели..." fullPage />

  if (!metrics) return null

  const cropChartData = Object.entries(metrics.byCrop).map(([crop, m]) => ({
    name: CROP_LABELS[crop] || crop,
    'MAE (т/га)': m.mae,
    'RMSE (т/га)': m.rmse,
    'R²': m.r2,
    samples: m.samples,
  }))

  const r2Quality = metrics.overall.r2 >= 0.85 ? 'success' : metrics.overall.r2 >= 0.7 ? 'warning' : 'danger'
  const accQuality = metrics.overall.accuracy >= 80 ? 'success' : metrics.overall.accuracy >= 65 ? 'warning' : 'danger'

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Метрики качества ML-модели</h1>
          <p className={styles.subtitle}>
            Тестирование RandomForest на отложенной выборке · Модель v{metrics.modelVersion}
          </p>
        </div>
        <div className={styles.updatedAt}>
          <span className="material-icons-round">schedule</span>
          Рассчитано: {new Date(metrics.trainedAt).toLocaleString('ru-RU')}
        </div>
      </div>

      {/* Overall Metrics */}
      <div className={styles.metricsGrid}>
        <Card className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ background: '#e8f0fe' }}>
            <span className="material-icons-round" style={{ color: '#1a73e8' }}>analytics</span>
          </div>
          <div className={styles.metricValue}>{metrics.overall.mae.toFixed(3)}</div>
          <div className={styles.metricLabel}>MAE (т/га)</div>
          <div className={styles.metricDesc}>Средняя абсолютная ошибка</div>
        </Card>
        <Card className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ background: '#fef9e0' }}>
            <span className="material-icons-round" style={{ color: '#f59e0b' }}>show_chart</span>
          </div>
          <div className={styles.metricValue}>{metrics.overall.rmse.toFixed(3)}</div>
          <div className={styles.metricLabel}>RMSE (т/га)</div>
          <div className={styles.metricDesc}>Среднеквадратичная ошибка</div>
        </Card>
        <Card className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ background: r2Quality === 'success' ? '#e6f4ea' : '#fce8e6' }}>
            <span className="material-icons-round" style={{ color: r2Quality === 'success' ? '#34a853' : '#ea4335' }}>
              {r2Quality === 'success' ? 'thumb_up' : 'thumb_down'}
            </span>
          </div>
          <div className={styles.metricValue}>{metrics.overall.r2.toFixed(3)}</div>
          <div className={styles.metricLabel}>R² (коэф. детерминации)</div>
          <Badge variant={r2Quality as any}>{r2Quality === 'success' ? 'Отлично' : r2Quality === 'warning' ? 'Приемлемо' : 'Плохо'}</Badge>
        </Card>
        <Card className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ background: accQuality === 'success' ? '#e6f4ea' : '#fce8e6' }}>
            <span className="material-icons-round" style={{ color: accQuality === 'success' ? '#34a853' : '#ea4335' }}>percent</span>
          </div>
          <div className={styles.metricValue}>{metrics.overall.accuracy.toFixed(1)}%</div>
          <div className={styles.metricLabel}>Точность (±15%)</div>
          <Badge variant={accQuality as any}>{accQuality === 'success' ? 'Хорошая' : 'Требует улучшения'}</Badge>
        </Card>
      </div>

      <div className={styles.testInfo}>
        <span className="material-icons-round">info</span>
        Тест проведён на <strong>{metrics.overall.testSamples}</strong> примерах отложенной выборки (20% датасета).
        Точность = доля прогнозов с отклонением менее 15% от реального значения.
      </div>

      {/* Per-crop Chart */}
      <Card>
        <h3 className={styles.sectionTitle}>Точность по культурам</h3>
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={cropChartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dadce0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#5f6368' }} />
              <YAxis tick={{ fontSize: 12, fill: '#5f6368' }} />
              <Tooltip
                contentStyle={{ border: '1px solid #dadce0', borderRadius: 8, fontSize: 12 }}
              />
              <Legend />
              <Bar dataKey="MAE (т/га)" fill="#1a73e8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="RMSE (т/га)" fill="#fbbc04" radius={[4, 4, 0, 0]} />
              <Bar dataKey="R²" fill="#34a853" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className={styles.cropTable}>
          <table>
            <thead>
              <tr><th>Культура</th><th>MAE</th><th>RMSE</th><th>R²</th><th>Выборка</th></tr>
            </thead>
            <tbody>
              {Object.entries(metrics.byCrop).map(([crop, m]) => (
                <tr key={crop}>
                  <td>{CROP_LABELS[crop] || crop}</td>
                  <td>{m.mae.toFixed(3)}</td>
                  <td>{m.rmse.toFixed(3)}</td>
                  <td className={m.r2 >= 0.85 ? styles.good : m.r2 >= 0.7 ? styles.ok : styles.bad}>
                    {m.r2.toFixed(3)}
                  </td>
                  <td>{m.samples}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Test Scenarios */}
      <Card>
        <h3 className={styles.sectionTitle}>Тестовые сценарии</h3>
        <p className={styles.scenariosDesc}>
          Проверка поведения системы на контрольных сценариях, включая сценарий из технического задания кейса.
        </p>
        <div className={styles.scenarios}>
          {metrics.scenarios.map((s, i) => (
            <div key={i} className={`${styles.scenario} ${styles[s.status]}`}>
              <div className={styles.scenarioHeader}>
                <span className={`material-icons-round ${styles.scenarioIcon}`}>
                  {s.status === 'pass' ? 'check_circle' : 'cancel'}
                </span>
                <strong>{s.name}</strong>
                <Badge variant={s.status === 'pass' ? 'success' : 'danger'}>
                  {s.status === 'pass' ? 'ПРОЙДЕН' : 'ПРОВАЛЕН'}
                </Badge>
              </div>
              <p className={styles.scenarioDesc}>{s.description}</p>
              <div className={styles.scenarioParams}>
                <span><strong>Влажность:</strong> {s.inputMoisture}%</span>
                <span><strong>Температура:</strong> {s.inputTemp}°C</span>
                <span><strong>Ожидаемая достоверность:</strong> {s.expectedConfidence}</span>
                <span><strong>Фактическая:</strong>{' '}
                  <span className={s.actualConfidence === s.expectedConfidence ? styles.good : styles.bad}>
                    {s.actualConfidence}
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export default ModelMetricsPage
