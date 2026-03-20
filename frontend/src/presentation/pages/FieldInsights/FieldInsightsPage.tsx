import React, { useEffect, useMemo, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@application/store/hooks'
import { fetchFields } from '@application/store/slices/fieldsSlice'
import { fieldApi } from '@infrastructure/api/FieldApi'
import { FieldFinance, FieldPassport, FieldSatellite } from '@domain/entities/Field'
import Card from '@presentation/components/common/Card/Card'
import Select from '@presentation/components/common/Select/Select'
import Loader from '@presentation/components/common/Loader/Loader'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import styles from './FieldInsightsPage.module.scss'

const money = (v: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(v)

const FieldInsightsPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { items: fields, loading: fieldsLoading } = useAppSelector(s => s.fields)
  const [fieldId, setFieldId] = useState('')
  const [loading, setLoading] = useState(false)
  const [passport, setPassport] = useState<FieldPassport | null>(null)
  const [satellite, setSatellite] = useState<FieldSatellite | null>(null)
  const [finance, setFinance] = useState<FieldFinance | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    dispatch(fetchFields())
  }, [dispatch])

  useEffect(() => {
    if (!fieldId && fields.length) {
      setFieldId(fields[0].id)
    }
  }, [fieldId, fields])

  useEffect(() => {
    if (!fieldId) return
    setLoading(true)
    setError(null)
    Promise.all([
      fieldApi.getPassport(fieldId),
      fieldApi.getSatellite(fieldId, 14),
      fieldApi.getFinance(fieldId),
    ])
      .then(([p, s, f]) => {
        setPassport(p)
        setSatellite(s)
        setFinance(f)
      })
      .catch((e: any) => {
        setError(e.response?.data?.message || 'Не удалось загрузить данные по полю')
      })
      .finally(() => setLoading(false))
  }, [fieldId])

  const options = useMemo(
    () => fields.map(f => ({ value: f.id, label: `${f.name} (${f.area} га)` })),
    [fields]
  )

  if (fieldsLoading && !fields.length) return <Loader text="Загрузка полей..." fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Полевой цифровой паспорт и аналитика</h1>
          <p className={styles.subtitle}>История операций, NDVI/NDMI и финансовая панель по каждому полю</p>
        </div>
        <div className={styles.selector}>
          <Select options={options} value={fieldId} onChange={e => setFieldId(e.target.value)} />
        </div>
      </div>

      {error && <Card className={styles.errorCard}>{error}</Card>}
      {loading && <Loader text="Собираем аналитику..." />}

      {!loading && passport && satellite && finance && (
        <>
          <div className={styles.kpiGrid}>
            <Card><div className={styles.kpiLabel}>Всего затрат</div><div className={styles.kpiValue}>{money(passport.totals.totalCost)}</div></Card>
            <Card><div className={styles.kpiLabel}>Последний NDVI / NDMI</div><div className={styles.kpiValue}>{satellite.latestNdvi} / {satellite.latestNdmi}</div></Card>
            <Card><div className={styles.kpiLabel}>Водосбережение</div><div className={styles.kpiValue}>{finance.waterSavingPercent}%</div></Card>
            <Card><div className={styles.kpiLabel}>Маржинальность</div><div className={styles.kpiValue}>{finance.marginPercent}%</div></Card>
          </div>

          <div className={styles.grid2}>
            <Card>
              <h3 className={styles.sectionTitle}>Паспорт операций</h3>
              <div className={styles.table}>
                {[...passport.operations, ...passport.fertilizers, ...passport.treatments].map((r, i) => (
                  <div key={`${r.type}-${i}`} className={styles.row}>
                    <span>{new Date(r.date).toLocaleDateString('ru-RU')}</span>
                    <span>{r.description}</span>
                    <span>{r.amount ?? '—'} {r.unit ?? ''}</span>
                    <span>{money(r.cost ?? 0)}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className={styles.sectionTitle}>Спутниковая аналитика (NDVI/NDMI)</h3>
              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={satellite.timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 1]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="ndvi" stroke="#1a73e8" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="ndmi" stroke="#34a853" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className={styles.meta}>Уровень стресса: <strong>{satellite.stressLevel}</strong></p>
              <ul className={styles.list}>
                {satellite.alerts.map((a, i) => <li key={`a-${i}`}>{a}</li>)}
                {satellite.recommendations.map((r, i) => <li key={`r-${i}`}>{r}</li>)}
              </ul>
            </Card>
          </div>

          <Card>
            <h3 className={styles.sectionTitle}>Финансовая панель</h3>
            <div className={styles.financeTop}>
              <div>План: <strong>{money(finance.planCost)}</strong></div>
              <div>Факт: <strong>{money(finance.actualCost)}</strong></div>
              <div>Выручка: <strong>{money(finance.grossRevenue)}</strong></div>
              <div>Маржа: <strong>{money(finance.margin)}</strong></div>
              <div>Себестоимость/га: <strong>{money(finance.costPerHectare)}</strong></div>
            </div>
            <div className={styles.table}>
              {finance.breakdown.map((b) => (
                <div key={b.category} className={styles.row}>
                  <span>{b.category}</span>
                  <span>{money(b.planned)}</span>
                  <span>{money(b.actual)}</span>
                  <span>{money(b.actual - b.planned)}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

export default FieldInsightsPage
