import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@application/store/hooks'
import { fetchFields } from '@application/store/slices/fieldsSlice'
import { fetchYieldForecast, fetchHistoricalYield } from '@application/store/slices/forecastSlice'
import Card from '@presentation/components/common/Card/Card'
import Badge from '@presentation/components/common/Badge/Badge'
import Button from '@presentation/components/common/Button/Button'
import Select from '@presentation/components/common/Select/Select'
import Loader from '@presentation/components/common/Loader/Loader'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ReferenceLine, Area, AreaChart, ErrorBar
} from 'recharts'
import styles from './ForecastPage.module.scss'

const cropLabels: Record<string, string> = {
  wheat: 'Пшеница', corn: 'Кукуруза', sunflower: 'Подсолнечник',
  barley: 'Ячмень', soy: 'Соя', sugar_beet: 'Сахарная свёкла', other: 'Другая',
}

const confidenceLabels: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  HIGH: { label: 'Высокая', variant: 'success' },
  MEDIUM: { label: 'Средняя', variant: 'warning' },
  LOW: { label: 'Низкая', variant: 'danger' },
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.tooltip}>
        <div className={styles.tooltipLabel}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} className={styles.tooltipRow}>
            <span style={{ color: p.color }}>●</span>
            <span>{p.name}:</span>
            <strong>{p.value?.toFixed ? p.value.toFixed(2) : p.value} т/га</strong>
          </div>
        ))}
      </div>
    )
  }
  return null
}

const ForecastPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { items: fields, loading: fieldsLoading } = useAppSelector(s => s.fields)
  const { currentForecast, historicalYields, loading } = useAppSelector(s => s.forecast)
  const [selectedFieldId, setSelectedFieldId] = useState('')

  useEffect(() => {
    dispatch(fetchFields())
  }, [dispatch])

  useEffect(() => {
    if (fields.length > 0 && !selectedFieldId) {
      setSelectedFieldId(fields[0].id)
    }
  }, [fields, selectedFieldId])

  useEffect(() => {
    if (selectedFieldId) {
      dispatch(fetchYieldForecast({ fieldId: selectedFieldId, targetDate: new Date().toISOString().split('T')[0] }))
      dispatch(fetchHistoricalYield(selectedFieldId))
    }
  }, [selectedFieldId, dispatch])

  const fieldOptions = fields.map(f => ({
    value: f.id,
    label: `${f.name} — ${cropLabels[f.cropType]}, ${f.area} га`,
  }))

  const historicalData = (historicalYields[selectedFieldId] || []).map(h => ({
    year: String(h.year),
    'Фактическая урожайность': h.yield,
    'Осадки, мм': h.precipitation / 100,
    'Ср. температура': h.avgTemperature,
  }))

  const selectedField = fields.find(f => f.id === selectedFieldId)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Прогноз урожайности</h1>
          <p className={styles.subtitle}>ML-модели на основе погодных и исторических данных</p>
        </div>
        <Select
          options={fieldOptions}
          value={selectedFieldId}
          onChange={e => setSelectedFieldId(e.target.value)}
          label="Поле"
        />
      </div>

      {(loading || fieldsLoading) && !currentForecast && (
        <Loader text="Расчёт прогноза..." />
      )}

      {currentForecast && (
        <>
          {/* Forecast Summary */}
          <div className={styles.forecastSummary}>
            <Card className={styles.mainForecastCard}>
              <div className={styles.forecastHeader}>
                <div>
                  <div className={styles.forecastTitle}>Прогноз урожайности</div>
                  <div className={styles.forecastField}>{currentForecast.fieldName}</div>
                  <div className={styles.forecastCrop}>{currentForecast.cropType}</div>
                </div>
                <Badge variant={confidenceLabels[currentForecast.confidence].variant}>
                  Достоверность: {confidenceLabels[currentForecast.confidence].label}
                </Badge>
              </div>

              <div className={styles.yieldDisplay}>
                <div className={styles.yieldValue}>
                  {currentForecast.predictedYield}
                  <span className={styles.yieldUnit}>т/га</span>
                </div>
                <div className={styles.yieldRange}>
                  Диапазон: {currentForecast.yieldMin} – {currentForecast.yieldMax} т/га
                </div>
                {currentForecast.historicalAverage && (
                  <div className={`${styles.yieldDelta} ${currentForecast.predictedYield >= currentForecast.historicalAverage ? styles.positive : styles.negative}`}>
                    <span className="material-icons-round">
                      {currentForecast.predictedYield >= currentForecast.historicalAverage ? 'trending_up' : 'trending_down'}
                    </span>
                    {Math.abs(((currentForecast.predictedYield - currentForecast.historicalAverage) / currentForecast.historicalAverage) * 100).toFixed(1)}%
                    {currentForecast.predictedYield >= currentForecast.historicalAverage ? ' выше' : ' ниже'} среднего
                    ({currentForecast.historicalAverage} т/га)
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div className={styles.yieldBar}>
                <div className={styles.yieldBarFill}
                  style={{
                    width: `${Math.min(100, (currentForecast.predictedYield / (currentForecast.yieldMax * 1.1)) * 100)}%`
                  }}
                />
                <div className={styles.yieldBarMin}
                  style={{ left: `${(currentForecast.yieldMin / (currentForecast.yieldMax * 1.1)) * 100}%` }}
                />
                <div className={styles.yieldBarMax}
                  style={{ left: `${(currentForecast.yieldMax / (currentForecast.yieldMax * 1.1)) * 100}%` }}
                />
              </div>
              <div className={styles.yieldBarLabels}>
                <span>Мин: {currentForecast.yieldMin} т/га</span>
                <span>Прогноз: {currentForecast.predictedYield} т/га</span>
                <span>Макс: {currentForecast.yieldMax} т/га</span>
              </div>
            </Card>

            {/* Factors */}
            <Card className={styles.factorsCard}>
              <h3 className={styles.factorsTitle}>Факторы прогноза</h3>
              <div className={styles.factorsList}>
                {currentForecast.factors.map((factor, i) => (
                  <div key={i} className={styles.factorItem}>
                    <div className={styles.factorTop}>
                      <span className={`material-icons-round ${styles.factorIcon} ${styles[`impact-${factor.impact}`]}`}>
                        {factor.impact === 'positive' ? 'arrow_upward' : factor.impact === 'negative' ? 'arrow_downward' : 'remove'}
                      </span>
                      <span className={styles.factorName}>{factor.name}</span>
                      <span className={styles.factorWeight}>{Math.round(factor.weight * 100)}%</span>
                    </div>
                    <div className={styles.factorBar}>
                      <div
                        className={`${styles.factorBarFill} ${styles[`impact-${factor.impact}`]}`}
                        style={{ width: `${factor.weight * 100}%` }}
                      />
                    </div>
                    <p className={styles.factorDesc}>{factor.description}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Historical Chart */}
          <Card>
            <h3 className={styles.sectionTitle}>Историческая урожайность</h3>
            <div className={styles.chart}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dadce0" />
                  <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#5f6368' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#5f6368' }} unit=" т/га" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="Фактическая урожайность" fill="#1a73e8" radius={[4, 4, 0, 0]} />
                  <ReferenceLine
                    y={currentForecast.historicalAverage}
                    stroke="#34a853"
                    strokeDasharray="5 5"
                    label={{ value: 'Среднее', position: 'right', fontSize: 11, fill: '#34a853' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Model info */}
          <div className={styles.modelInfo}>
            <span className="material-icons-round">info</span>
            Прогноз рассчитан моделью v{currentForecast.modelVersion} · Дата расчёта: {new Date(currentForecast.createdAt).toLocaleString('ru-RU')}
          </div>
        </>
      )}
    </div>
  )
}

export default ForecastPage
