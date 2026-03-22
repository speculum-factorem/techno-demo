import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@application/store/hooks'
import { fetchModelMetrics } from '@application/store/slices/anomalySlice'
import { analyticsApi } from '@infrastructure/api/AnalyticsApi'
import Card from '@presentation/components/common/Card/Card'
import Badge from '@presentation/components/common/Badge/Badge'
import Loader from '@presentation/components/common/Loader/Loader'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, Cell,
} from 'recharts'
import styles from './ModelMetricsPage.module.scss'

const CROP_LABELS: Record<string, string> = {
  wheat: 'Пшеница', corn: 'Кукуруза', sunflower: 'Подсолнечник',
  barley: 'Ячмень', soy: 'Соя', sugar_beet: 'Сах. свёкла', other: 'Другие',
}

const FIELD_LABELS: Record<string, string> = {
  temperature: 'Температура, °C',
  humidity_air: 'Влажность воздуха, %',
  precipitation: 'Осадки, мм',
  wind_speed: 'Скорость ветра, м/с',
  soil_moisture: 'Влажность почвы, %',
  yield_actual: 'Урожайность (норм. 0–1)',
  irrigation_volume: 'Объём полива, л/м²',
  irrigation_recommended: 'Рек. полив, л/м²',
}

type Tab = 'metrics' | 'eda'

const ModelMetricsPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { metrics, loadingMetrics } = useAppSelector(s => s.anomaly)
  const [tab, setTab] = useState<Tab>('metrics')
  const [eda, setEda] = useState<any>(null)
  const [edaLoading, setEdaLoading] = useState(false)

  useEffect(() => {
    dispatch(fetchModelMetrics())
  }, [dispatch])

  useEffect(() => {
    if (tab === 'eda' && !eda) {
      setEdaLoading(true)
      analyticsApi.getDatasetEda(2000)
        .then(setEda)
        .finally(() => setEdaLoading(false))
    }
  }, [tab, eda])

  if (loadingMetrics && !metrics) return <Loader text="Загрузка оценки прогноза..." fullPage />
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
          <h1 className={styles.title}>Точность прогноза урожайности</h1>
          <p className={styles.subtitle}>
            Оценка качества прогнозов по историческим данным
          </p>
        </div>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'metrics' ? styles.tabActive : ''}`} onClick={() => setTab('metrics')}>
            <span className="material-icons-round">analytics</span> Сводка точности
          </button>
          <button className={`${styles.tab} ${tab === 'eda' ? styles.tabActive : ''}`} onClick={() => setTab('eda')}>
            <span className="material-icons-round">dataset</span> Данные для расчёта
          </button>
        </div>
      </div>

      {/* ===== METRICS TAB ===== */}
      {tab === 'metrics' && (
        <>
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
              <div className={styles.metricLabel}>R²</div>
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
            Проверка на <strong>{metrics.overall.testSamples}</strong> примерах. Точность — доля прогнозов с отклонением не более 15%.
          </div>

          <Card>
            <h3 className={styles.sectionTitle}>Точность по культурам</h3>
            <div className={styles.chart}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={cropChartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dadce0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#5f6368' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#5f6368' }} />
                  <Tooltip contentStyle={{ border: '1px solid #dadce0', borderRadius: 8, fontSize: 12 }} />
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
                      <td className={m.r2 >= 0.85 ? styles.good : m.r2 >= 0.7 ? styles.ok : styles.bad}>{m.r2.toFixed(3)}</td>
                      <td>{m.samples}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h3 className={styles.sectionTitle}>Тестовые сценарии кейса</h3>
            <p className={styles.scenariosDesc}>Проверка на типовых ситуациях по влажности и температуре.</p>
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
                    <span><strong>Ожид. достоверность:</strong> {s.expectedConfidence}</span>
                    <span><strong>Факт:</strong>{' '}
                      <span className={s.actualConfidence === s.expectedConfidence ? styles.good : styles.bad}>
                        {s.actualConfidence}
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* ===== EDA TAB ===== */}
      {tab === 'eda' && (
        edaLoading ? <Loader text="Загрузка сводки..." /> : eda && (
          <>
            {/* Dataset summary */}
            <div className={styles.metricsGrid}>
              <Card className={styles.metricCard}>
                <div className={styles.metricIcon} style={{ background: '#e8f0fe' }}>
                  <span className="material-icons-round" style={{ color: '#1a73e8' }}>table_rows</span>
                </div>
                <div className={styles.metricValue}>{eda.dataset_info.n_rows.toLocaleString('ru-RU')}</div>
                <div className={styles.metricLabel}>Строк в датасете</div>
                <div className={styles.metricDesc}>{eda.dataset_info.n_cols} обязательных полей</div>
              </Card>
              <Card className={styles.metricCard}>
                <div className={styles.metricIcon} style={{ background: '#e6f4ea' }}>
                  <span className="material-icons-round" style={{ color: '#34a853' }}>grass</span>
                </div>
                <div className={styles.metricValue}>{eda.dataset_info.unique_fields}</div>
                <div className={styles.metricLabel}>Уникальных полей</div>
                <div className={styles.metricDesc}>{eda.dataset_info.unique_crops} культур</div>
              </Card>
              <Card className={styles.metricCard}>
                <div className={styles.metricIcon} style={{ background: '#fce8e6' }}>
                  <span className="material-icons-round" style={{ color: '#ea4335' }}>warning</span>
                </div>
                <div className={styles.metricValue}>{eda.anomaly_analysis.anomaly_rate_pct}%</div>
                <div className={styles.metricLabel}>Доля аномалий</div>
                <div className={styles.metricDesc}>{eda.anomaly_analysis.total_anomalies} подозрительных записей</div>
              </Card>
              <Card className={styles.metricCard}>
                <div className={styles.metricIcon} style={{ background: '#fef9e0' }}>
                  <span className="material-icons-round" style={{ color: '#f59e0b' }}>date_range</span>
                </div>
                <div className={styles.metricValue} style={{ fontSize: '1rem' }}>{eda.dataset_info.date_range.from}</div>
                <div className={styles.metricLabel}>Начало периода</div>
                <div className={styles.metricDesc}>до {eda.dataset_info.date_range.to}</div>
              </Card>
            </div>

            {/* Mandatory fields list */}
            <Card>
              <h3 className={styles.sectionTitle}>Показатели в расчёте</h3>
              <div className={styles.fieldGrid}>
                {eda.dataset_info.mandatory_fields.map((f: string) => (
                  <div key={f} className={styles.fieldChip}>
                    <span className="material-icons-round">check_circle</span>
                    <code>{f}</code>
                  </div>
                ))}
              </div>
            </Card>

            {/* Descriptive stats */}
            <Card>
              <h3 className={styles.sectionTitle}>Сводка по числовым показателям</h3>
              <div className={styles.cropTable}>
                <table>
                  <thead>
                    <tr>
                      <th>Поле</th><th>Среднее</th><th>Std</th><th>Min</th>
                      <th>Q25</th><th>Медиана</th><th>Q75</th><th>Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(eda.descriptive_stats).map(([col, s]: [string, any]) => (
                      <tr key={col}>
                        <td><strong>{FIELD_LABELS[col] || col}</strong></td>
                        <td>{s.mean}</td>
                        <td>{s.std}</td>
                        <td>{s.min}</td>
                        <td>{s.q25}</td>
                        <td>{s.median}</td>
                        <td>{s.q75}</td>
                        <td>{s.max}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Crop distribution + yield */}
            <div className={styles.grid2col}>
              <Card>
                <h3 className={styles.sectionTitle}>Распределение по культурам</h3>
                <div className={styles.chart}>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={Object.entries(eda.crop_distribution).map(([k, v]) => ({ name: CROP_LABELS[k] || k, Количество: v }))}
                      margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#dadce0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="Количество" fill="#1a73e8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card>
                <h3 className={styles.sectionTitle}>Средняя нормированная урожайность по культурам</h3>
                <div className={styles.chart}>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={Object.entries(eda.yield_by_crop).map(([k, v]) => ({ name: CROP_LABELS[k] || k, 'yield_actual': v }))}
                      margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#dadce0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="yield_actual" fill="#34a853" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Outliers */}
            <Card>
              <h3 className={styles.sectionTitle}>Редкие значения по показателям</h3>
              <div className={styles.cropTable}>
                <table>
                  <thead>
                    <tr><th>Показатель</th><th>Редких значений</th><th>Доля, %</th><th>Оценка</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(eda.outliers).map(([col, o]: [string, any]) => (
                      <tr key={col}>
                        <td><strong>{FIELD_LABELS[col] || col}</strong></td>
                        <td>{o.iqr_outliers}</td>
                        <td>{o.outlier_rate_pct}%</td>
                        <td className={o.outlier_rate_pct > 5 ? styles.bad : o.outlier_rate_pct > 2 ? styles.ok : styles.good}>
                          {o.outlier_rate_pct > 5 ? '⚠ Высокий' : o.outlier_rate_pct > 2 ? '~ Умеренный' : '✓ Норма'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Anomaly breakdown */}
            <Card>
              <h3 className={styles.sectionTitle}>Аномальные записи по культурам</h3>
              <div className={styles.chart}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={Object.entries(eda.anomaly_analysis.anomaly_by_crop).map(([k, v]) => ({ name: CROP_LABELS[k] || k, Аномалии: v }))}
                    margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dadce0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="Аномалии" fill="#ea4335" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </>
        )
      )}
    </div>
  )
}

export default ModelMetricsPage
