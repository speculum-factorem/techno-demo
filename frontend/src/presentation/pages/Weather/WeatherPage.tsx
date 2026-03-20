import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@application/store/hooks'
import { fetchFields } from '@application/store/slices/fieldsSlice'
import { fetchWeatherSummary, fetchHistoricalWeather } from '@application/store/slices/weatherSlice'
import Card from '@presentation/components/common/Card/Card'
import Select from '@presentation/components/common/Select/Select'
import Loader from '@presentation/components/common/Loader/Loader'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, BarChart, Bar, ComposedChart, Area
} from 'recharts'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import styles from './WeatherPage.module.scss'

const weatherCodeIcon: Record<number, string> = {
  0: 'wb_sunny', 1: 'partly_cloudy_day', 2: 'cloud', 3: 'cloud',
  61: 'water_drop', 63: 'grain', 65: 'thunderstorm', 80: 'grain',
}

const WeatherPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { items: fields } = useAppSelector(s => s.fields)
  const { summaries, historical, loading } = useAppSelector(s => s.weather)
  const [selectedFieldId, setSelectedFieldId] = useState('')
  const [activeTab, setActiveTab] = useState<'current' | 'forecast' | 'history'>('current')

  useEffect(() => { dispatch(fetchFields()) }, [dispatch])

  useEffect(() => {
    if (fields.length > 0 && !selectedFieldId) setSelectedFieldId(fields[0].id)
  }, [fields, selectedFieldId])

  useEffect(() => {
    if (selectedFieldId) {
      dispatch(fetchWeatherSummary(selectedFieldId))
      const to = new Date().toISOString().split('T')[0]
      const from = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0]
      dispatch(fetchHistoricalWeather({ fieldId: selectedFieldId, from, to }))
    }
  }, [selectedFieldId, dispatch])

  const summary = summaries[selectedFieldId]
  const hist = historical[selectedFieldId] || []

  const histChartData = hist.map(d => ({
    date: format(new Date(d.timestamp), 'd MMM', { locale: ru }),
    'Температура, °C': +d.temperature.toFixed(1),
    'Влажность, %': +d.humidity.toFixed(1),
    'Осадки, мм': +d.precipitation.toFixed(1),
    'Влажность почвы, %': d.soilMoisture ? +d.soilMoisture.toFixed(1) : null,
  }))

  const fieldOptions = fields.map(f => ({ value: f.id, label: f.name }))

  if (!summary && loading) return <Loader text="Загрузка данных..." fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Погода и метеоданные</h1>
          <p className={styles.subtitle}>Текущие данные, прогноз и исторические наблюдения</p>
        </div>
        <Select
          options={fieldOptions}
          value={selectedFieldId}
          onChange={e => setSelectedFieldId(e.target.value)}
          label="Поле"
        />
      </div>

      <div className={styles.tabs}>
        {[
          { key: 'current', label: 'Текущие данные', icon: 'thermostat' },
          { key: 'forecast', label: 'Прогноз 7 дней', icon: 'cloud' },
          { key: 'history', label: 'История 30 дней', icon: 'history' },
        ].map(tab => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(tab.key as any)}
          >
            <span className="material-icons-round">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'current' && summary && (
        <div className={styles.currentGrid}>
          <Card className={styles.bigWeatherCard}>
            <div className={styles.bigWeatherTop}>
              <div className={styles.bigTemp}>{summary.current.temperature.toFixed(1)}°C</div>
              <div className={styles.bigWeatherInfo}>
                <div className={styles.bigWeatherLabel}>Температура воздуха</div>
                <div className={styles.bigWeatherSub}>
                  Почва: {summary.current.soilTemperature?.toFixed(1)}°C
                </div>
              </div>
            </div>
            <div className={styles.weatherMetrics}>
              {[
                { icon: 'water_drop', label: 'Влажность воздуха', value: `${summary.current.humidity.toFixed(0)}%` },
                { icon: 'opacity', label: 'Влажность почвы', value: `${summary.current.soilMoisture?.toFixed(0)}%` },
                { icon: 'air', label: 'Скорость ветра', value: `${summary.current.windSpeed.toFixed(1)} м/с` },
                { icon: 'compress', label: 'Давление', value: `${summary.current.pressure.toFixed(0)} гПа` },
                { icon: 'grain', label: 'Осадки', value: `${summary.current.precipitation.toFixed(1)} мм` },
                { icon: 'wb_sunny', label: 'Солнечная радиация', value: `${summary.current.solarRadiation.toFixed(0)} Вт/м²` },
              ].map(m => (
                <div key={m.label} className={styles.metric}>
                  <span className={`material-icons-round ${styles.metricIcon}`}>{m.icon}</span>
                  <div className={styles.metricValue}>{m.value}</div>
                  <div className={styles.metricLabel}>{m.label}</div>
                </div>
              ))}
            </div>
          </Card>

          <div className={styles.summaryStats}>
            <Card className={styles.summaryCard}>
              <div className={styles.summaryTitle}>Средние за 7 дней</div>
              <div className={styles.summaryItems}>
                <div className={styles.summaryItem}>
                  <span className="material-icons-round">thermostat</span>
                  <div>
                    <div className={styles.summaryValue}>{summary.averageTemperature7d.toFixed(1)}°C</div>
                    <div className={styles.summaryLabel}>Ср. температура</div>
                  </div>
                </div>
                <div className={styles.summaryItem}>
                  <span className="material-icons-round">grain</span>
                  <div>
                    <div className={styles.summaryValue}>{summary.totalPrecipitation7d.toFixed(1)} мм</div>
                    <div className={styles.summaryLabel}>Осадки (сумма)</div>
                  </div>
                </div>
                <div className={styles.summaryItem}>
                  <span className="material-icons-round">water</span>
                  <div>
                    <div className={styles.summaryValue}>{summary.averageHumidity7d.toFixed(1)}%</div>
                    <div className={styles.summaryLabel}>Ср. влажность</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'forecast' && summary && (
        <div className={styles.forecastGrid}>
          {summary.forecast.map((day, i) => (
            <Card key={i} className={styles.forecastDayCard} hoverable>
              <div className={styles.forecastDayName}>
                {i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' :
                  format(new Date(day.date), 'EEE, d MMM', { locale: ru })}
              </div>
              <span className={`material-icons-round ${styles.forecastDayIcon}`}>
                {weatherCodeIcon[day.weatherCode] || 'cloud'}
              </span>
              <div className={styles.forecastDayDesc}>{day.description}</div>
              <div className={styles.forecastDayTemp}>
                <span className={styles.tempMax}>{day.tempMax.toFixed(0)}°</span>
                <span className={styles.tempMin}>{day.tempMin.toFixed(0)}°</span>
              </div>
              <div className={styles.forecastDayDetails}>
                <span><span className="material-icons-round">water_drop</span>{day.precipitationProbability.toFixed(0)}%</span>
                <span><span className="material-icons-round">grain</span>{day.precipitation.toFixed(1)} мм</span>
                <span><span className="material-icons-round">air</span>{day.windSpeed.toFixed(0)} м/с</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'history' && (
        <div className={styles.historyCharts}>
          <Card>
            <h3 className={styles.chartTitle}>Температура воздуха (30 дней)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={histChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dadce0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
                <YAxis tick={{ fontSize: 11 }} unit="°C" />
                <Tooltip />
                <Line type="monotone" dataKey="Температура, °C" stroke="#1a73e8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 className={styles.chartTitle}>Влажность почвы и воздуха (30 дней)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={histChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dadce0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Влажность, %" stroke="#34a853" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Влажность почвы, %" stroke="#ea4335" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 className={styles.chartTitle}>Осадки (30 дней)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={histChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dadce0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
                <YAxis tick={{ fontSize: 11 }} unit=" мм" />
                <Tooltip />
                <Bar dataKey="Осадки, мм" fill="#1a73e8" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
    </div>
  )
}

export default WeatherPage
