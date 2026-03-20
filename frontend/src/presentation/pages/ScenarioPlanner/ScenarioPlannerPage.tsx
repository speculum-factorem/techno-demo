import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@application/store/hooks'
import { fetchFields } from '@application/store/slices/fieldsSlice'
import { analyticsApi } from '@infrastructure/api/AnalyticsApi'
import { WhatIfScenarioInput, WhatIfSimulationResponse } from '@domain/entities/Scenario'
import Card from '@presentation/components/common/Card/Card'
import Button from '@presentation/components/common/Button/Button'
import Select from '@presentation/components/common/Select/Select'
import Input from '@presentation/components/common/Input/Input'
import Loader from '@presentation/components/common/Loader/Loader'
import styles from './ScenarioPlannerPage.module.scss'

const money = (value: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value)

const ScenarioPlannerPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { items: fields } = useAppSelector(s => s.fields)
  const [fieldId, setFieldId] = useState('')
  const [pricePerTon, setPricePerTon] = useState('13500')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<WhatIfSimulationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scenarios, setScenarios] = useState<WhatIfScenarioInput[]>([
    { name: 'Экономия воды', irrigationMultiplier: 0.85, seedingMultiplier: 1.0 },
    { name: 'Интенсивный полив', irrigationMultiplier: 1.25, seedingMultiplier: 1.0 },
    { name: 'Интенсивная технология', irrigationMultiplier: 1.15, seedingMultiplier: 1.2 },
  ])

  useEffect(() => { dispatch(fetchFields()) }, [dispatch])
  useEffect(() => { if (!fieldId && fields.length) setFieldId(fields[0].id) }, [fieldId, fields])

  const runSimulation = async () => {
    if (!fieldId) return
    const field = fields.find(f => f.id === fieldId)
    setLoading(true)
    setError(null)
    try {
      const data = await analyticsApi.simulateWhatIf({
        fieldId,
        targetDate: new Date().toISOString().slice(0, 10),
        cropType: field?.cropType,
        soilType: field?.soilType,
        area: field?.area,
        expectedPricePerTon: Number(pricePerTon),
        scenarios,
      })
      setResult(data)
    } catch (e: any) {
      setError(e.response?.data?.detail || e.response?.data?.message || 'Не удалось выполнить симуляцию')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Сценарии “что если”</h1>
          <p className={styles.subtitle}>Симуляция стратегий полива и посева с прогнозом урожая, воды и ROI</p>
        </div>
        <Button icon="calculate" onClick={runSimulation} loading={loading}>Смоделировать</Button>
      </div>

      <Card>
        <div className={styles.controls}>
          <Select
            label="Поле"
            options={fields.map(f => ({ value: f.id, label: `${f.name} (${f.area} га)` }))}
            value={fieldId}
            onChange={(e) => setFieldId(e.target.value)}
          />
          <Input
            label="Цена реализации (RUB/т)"
            type="number"
            value={pricePerTon}
            onChange={(e) => setPricePerTon(e.target.value)}
          />
        </div>
      </Card>

      <div className={styles.grid}>
        {scenarios.map((s, idx) => (
          <Card key={idx}>
            <Input
              label="Название сценария"
              value={s.name}
              onChange={(e) => {
                const next = [...scenarios]
                next[idx] = { ...next[idx], name: e.target.value }
                setScenarios(next)
              }}
            />
            <Input
              label="Множитель полива"
              type="number"
              step="0.05"
              value={String(s.irrigationMultiplier)}
              onChange={(e) => {
                const next = [...scenarios]
                next[idx] = { ...next[idx], irrigationMultiplier: Number(e.target.value) }
                setScenarios(next)
              }}
            />
            <Input
              label="Множитель посева"
              type="number"
              step="0.05"
              value={String(s.seedingMultiplier)}
              onChange={(e) => {
                const next = [...scenarios]
                next[idx] = { ...next[idx], seedingMultiplier: Number(e.target.value) }
                setScenarios(next)
              }}
            />
          </Card>
        ))}
      </div>

      {loading && <Loader text="Считаем сценарии..." />}
      {error && <Card className={styles.error}>{error}</Card>}

      {result && (
        <Card>
          <h3 className={styles.sectionTitle}>Результаты симуляции</h3>
          <div className={styles.recommended}>Рекомендованный сценарий: <strong>{result.recommendedScenario}</strong></div>
          <div className={styles.table}>
            <div className={styles.rowHeader}>
              <span>Сценарий</span><span>Урожай (т/га)</span><span>Вода (м3)</span><span>Доход</span><span>Затраты</span><span>ROI</span>
            </div>
            <div className={styles.row}>
              <span>{result.baseline.name}</span>
              <span>{result.baseline.expectedYield}</span>
              <span>{result.baseline.expectedWaterM3}</span>
              <span>{money(result.baseline.expectedRevenue)}</span>
              <span>{money(result.baseline.expectedCost)}</span>
              <span>{result.baseline.roiPercent}%</span>
            </div>
            {result.scenarios.map((r, idx) => (
              <div key={idx} className={styles.row}>
                <span>{r.name}</span>
                <span>{r.expectedYield} ({r.expectedYieldDeltaPercent > 0 ? '+' : ''}{r.expectedYieldDeltaPercent}%)</span>
                <span>{r.expectedWaterM3} ({r.expectedWaterDeltaPercent > 0 ? '+' : ''}{r.expectedWaterDeltaPercent}%)</span>
                <span>{money(r.expectedRevenue)}</span>
                <span>{money(r.expectedCost)}</span>
                <span>{r.roiPercent}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

export default ScenarioPlannerPage
