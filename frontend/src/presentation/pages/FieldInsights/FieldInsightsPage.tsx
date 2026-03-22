import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@application/store/hooks'
import { fetchFields } from '@application/store/slices/fieldsSlice'
import { fieldApi } from '@infrastructure/api/FieldApi'
import { FieldFinance, FieldPassport, FieldSatellite, PassportEntryCategory } from '@domain/entities/Field'
import Card from '@presentation/components/common/Card/Card'
import Select from '@presentation/components/common/Select/Select'
import Button from '@presentation/components/common/Button/Button'
import Loader from '@presentation/components/common/Loader/Loader'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import styles from './FieldInsightsPage.module.scss'

const money = (v: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(v)

const CATEGORY_LABEL: Record<PassportEntryCategory, string> = {
  OPERATION: 'Операция',
  FERTILIZER: 'Удобрение',
  TREATMENT: 'СЗР',
}

const todayYmd = () => new Date().toISOString().slice(0, 10)

const FieldInsightsPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { items: fields, loading: fieldsLoading } = useAppSelector(s => s.fields)
  const [fieldId, setFieldId] = useState('')
  const [loading, setLoading] = useState(false)
  const [passport, setPassport] = useState<FieldPassport | null>(null)
  const [satellite, setSatellite] = useState<FieldSatellite | null>(null)
  const [finance, setFinance] = useState<FieldFinance | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [passportSaving, setPassportSaving] = useState(false)
  const [passportFormError, setPassportFormError] = useState<string | null>(null)

  const [entryCategory, setEntryCategory] = useState<PassportEntryCategory>('OPERATION')
  const [entryDate, setEntryDate] = useState(todayYmd())
  const [entryType, setEntryType] = useState('')
  const [entryDesc, setEntryDesc] = useState('')
  const [entryAmount, setEntryAmount] = useState('')
  const [entryUnit, setEntryUnit] = useState('')
  const [entryCost, setEntryCost] = useState('')
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)

  const [seasonName, setSeasonName] = useState('')
  const [seasonCrop, setSeasonCrop] = useState('')
  const [seasonYieldAct, setSeasonYieldAct] = useState('')
  const [seasonYieldPlan, setSeasonYieldPlan] = useState('')
  const [seasonRevenue, setSeasonRevenue] = useState('')
  const [seasonCost, setSeasonCost] = useState('')
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null)

  const reloadPassport = useCallback(async () => {
    if (!fieldId) return
    const p = await fieldApi.getPassport(fieldId)
    setPassport(p)
  }, [fieldId])

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
    setPassportFormError(null)
    setEditingEntryId(null)
    setEditingSeasonId(null)
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

  const resetEntryForm = () => {
    setEditingEntryId(null)
    setEntryCategory('OPERATION')
    setEntryDate(todayYmd())
    setEntryType('')
    setEntryDesc('')
    setEntryAmount('')
    setEntryUnit('')
    setEntryCost('')
  }

  const resetSeasonForm = () => {
    setEditingSeasonId(null)
    setSeasonName('')
    setSeasonCrop('')
    setSeasonYieldAct('')
    setSeasonYieldPlan('')
    setSeasonRevenue('')
    setSeasonCost('')
  }

  const parseNum = (s: string): number | undefined => {
    const t = s.trim()
    if (!t) return undefined
    const n = Number(t.replace(',', '.'))
    return Number.isFinite(n) ? n : undefined
  }

  const savePassportEntry = async () => {
    if (!fieldId || !entryType.trim()) {
      setPassportFormError('Укажите тип операции')
      return
    }
    setPassportFormError(null)
    setPassportSaving(true)
    try {
      const payload = {
        category: entryCategory,
        date: entryDate,
        type: entryType.trim(),
        description: entryDesc.trim() || undefined,
        amount: parseNum(entryAmount),
        unit: entryUnit.trim() || undefined,
        cost: parseNum(entryCost),
      }
      if (editingEntryId) {
        await fieldApi.updatePassportEntry(fieldId, editingEntryId, payload)
      } else {
        await fieldApi.addPassportEntry(fieldId, payload)
      }
      await reloadPassport()
      resetEntryForm()
    } catch (e: any) {
      const d = e.response?.data
      const msg = typeof d?.detail === 'string' ? d.detail : d?.message
      setPassportFormError(msg || 'Не удалось сохранить запись')
    } finally {
      setPassportSaving(false)
    }
  }

  const removePassportEntry = async (entryId: string) => {
    if (!fieldId) return
    setPassportSaving(true)
    setPassportFormError(null)
    try {
      await fieldApi.deletePassportEntry(fieldId, entryId)
      await reloadPassport()
      if (editingEntryId === entryId) resetEntryForm()
    } catch (e: any) {
      const d = e.response?.data
      setPassportFormError(typeof d?.detail === 'string' ? d.detail : 'Не удалось удалить')
    } finally {
      setPassportSaving(false)
    }
  }

  const startEditEntry = (row: FieldPassport['operations'][number]) => {
    if (!row.id) return
    setEditingEntryId(row.id)
    setEntryCategory((row.category as PassportEntryCategory) || 'OPERATION')
    setEntryDate(row.date?.slice(0, 10) || todayYmd())
    setEntryType(row.type || '')
    setEntryDesc(row.description || '')
    setEntryAmount(row.amount != null ? String(row.amount) : '')
    setEntryUnit(row.unit || '')
    setEntryCost(row.cost != null ? String(row.cost) : '')
  }

  const saveSeason = async () => {
    if (!fieldId || !seasonName.trim()) {
      setPassportFormError('Укажите сезон (например 2024/2025)')
      return
    }
    setPassportFormError(null)
    setPassportSaving(true)
    try {
      const payload = {
        season: seasonName.trim(),
        cropType: seasonCrop.trim() || undefined,
        yieldActual: parseNum(seasonYieldAct),
        yieldPlan: parseNum(seasonYieldPlan),
        revenueActual: parseNum(seasonRevenue),
        costActual: parseNum(seasonCost),
      }
      if (editingSeasonId) {
        await fieldApi.updateSeasonResult(fieldId, editingSeasonId, payload)
      } else {
        await fieldApi.addSeasonResult(fieldId, payload)
      }
      await reloadPassport()
      resetSeasonForm()
    } catch (e: any) {
      const d = e.response?.data
      setPassportFormError(typeof d?.detail === 'string' ? d.detail : 'Не удалось сохранить сезон')
    } finally {
      setPassportSaving(false)
    }
  }

  const removeSeason = async (resultId: string) => {
    if (!fieldId) return
    setPassportSaving(true)
    setPassportFormError(null)
    try {
      await fieldApi.deleteSeasonResult(fieldId, resultId)
      await reloadPassport()
      if (editingSeasonId === resultId) resetSeasonForm()
    } catch (e: any) {
      const d = e.response?.data
      setPassportFormError(typeof d?.detail === 'string' ? d.detail : 'Не удалось удалить')
    } finally {
      setPassportSaving(false)
    }
  }

  const startEditSeason = (r: FieldPassport['results'][number]) => {
    if (!r.id) return
    setEditingSeasonId(r.id)
    setSeasonName(r.season || '')
    setSeasonCrop(r.cropType || '')
    setSeasonYieldAct(r.yieldActual != null ? String(r.yieldActual) : '')
    setSeasonYieldPlan(r.yieldPlan != null ? String(r.yieldPlan) : '')
    setSeasonRevenue(r.revenueActual != null ? String(r.revenueActual) : '')
    setSeasonCost(r.costActual != null ? String(r.costActual) : '')
  }

  const options = useMemo(
    () => fields.map(f => ({ value: f.id, label: `${f.name} (${f.area} га)` })),
    [fields]
  )

  if (fieldsLoading && !fields.length) return <Loader text="Загрузка полей..." fullPage />

  if (!fields.length) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Полевой цифровой паспорт и аналитика</h1>
            <p className={styles.subtitle}>У вас пока нет полей</p>
          </div>
        </div>
        <Card className={styles.emptyCard}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIconWrap}>
              <span className="material-icons-round">assignment</span>
            </div>
            <h2 className={styles.emptyTitle}>У вас пока нет полей</h2>
            <p className={styles.emptyText}>
              Сначала создайте поле — затем здесь появятся паспорт операций, сезоны и финансовая сводка.
            </p>
            <Button icon="grass" onClick={() => navigate('/app/fields')}>
              Перейти к полям
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Полевой цифровой паспорт и аналитика</h1>
          <p className={styles.subtitle}>История операций, снимки вегетации и финансы по каждому полю</p>
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
            <Card><div className={styles.kpiLabel}>Вегетация / влага по снимкам</div><div className={styles.kpiValue}>{satellite.latestNdvi} / {satellite.latestNdmi}</div></Card>
            <Card><div className={styles.kpiLabel}>Водосбережение</div><div className={styles.kpiValue}>{finance.waterSavingPercent}%</div></Card>
            <Card><div className={styles.kpiLabel}>Маржинальность</div><div className={styles.kpiValue}>{finance.marginPercent}%</div></Card>
          </div>

          <div className={styles.grid2}>
            <Card>
              <h3 className={styles.sectionTitle}>Паспорт операций</h3>
              <p className={styles.passportHint}>
                Добавляйте операции, удобрения и обработки — итоги пересчитываются автоматически.
              </p>
              {passportFormError && <p className={styles.formError}>{passportFormError}</p>}
              <div className={styles.passportForm}>
                <div className={styles.formGrid}>
                  <label className={styles.formLabel}>
                    Раздел
                    <select
                      className={styles.formInput}
                      value={entryCategory}
                      onChange={e => setEntryCategory(e.target.value as PassportEntryCategory)}
                    >
                      {(Object.keys(CATEGORY_LABEL) as PassportEntryCategory[]).map(c => (
                        <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.formLabel}>
                    Дата
                    <input className={styles.formInput} type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
                  </label>
                  <label className={styles.formLabel}>
                    Тип (код)
                    <input className={styles.formInput} value={entryType} onChange={e => setEntryType(e.target.value)} placeholder="IRRIGATION" />
                  </label>
                  <label className={styles.formLabel}>
                    Описание
                    <input className={styles.formInput} value={entryDesc} onChange={e => setEntryDesc(e.target.value)} placeholder="Плановый полив" />
                  </label>
                  <label className={styles.formLabel}>
                    Количество
                    <input className={styles.formInput} value={entryAmount} onChange={e => setEntryAmount(e.target.value)} placeholder="420" />
                  </label>
                  <label className={styles.formLabel}>
                    Ед.
                    <input className={styles.formInput} value={entryUnit} onChange={e => setEntryUnit(e.target.value)} placeholder="м³" />
                  </label>
                  <label className={styles.formLabel}>
                    Затраты, ₽
                    <input className={styles.formInput} value={entryCost} onChange={e => setEntryCost(e.target.value)} placeholder="6300" />
                  </label>
                </div>
                <div className={styles.formActions}>
                  <Button type="button" size="sm" loading={passportSaving} onClick={() => void savePassportEntry()}>
                    {editingEntryId ? 'Сохранить запись' : 'Добавить запись'}
                  </Button>
                  {editingEntryId && (
                    <Button type="button" size="sm" variant="ghost" onClick={resetEntryForm}>Отмена</Button>
                  )}
                </div>
              </div>
              <div className={styles.table}>
                {[...passport.operations, ...passport.fertilizers, ...passport.treatments]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((r) => (
                  <div key={r.id ?? `${r.date}-${r.type}`} className={styles.rowPassport}>
                    <span className={styles.catCell} title={r.category}>
                      {r.category ? CATEGORY_LABEL[r.category as PassportEntryCategory] ?? r.category : '—'}
                    </span>
                    <span>{new Date(r.date).toLocaleDateString('ru-RU')}</span>
                    <span>
                      <strong>{r.type}</strong>
                      {r.description ? ` — ${r.description}` : ''}
                    </span>
                    <span>{r.amount != null ? `${r.amount} ${r.unit ?? ''}` : '—'}</span>
                    <span>{money(r.cost ?? 0)}</span>
                    <span className={styles.rowActions}>
                      {r.id && (
                        <>
                          <button type="button" className={styles.linkBtn} onClick={() => startEditEntry(r)}>Изменить</button>
                          <button type="button" className={styles.linkBtnDanger} onClick={() => void removePassportEntry(r.id!)}>Удалить</button>
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              {![...passport.operations, ...passport.fertilizers, ...passport.treatments].length && (
                <p className={styles.emptyHint}>Пока нет записей — добавьте первую операцию выше.</p>
              )}

              <h3 className={styles.sectionTitle} style={{ marginTop: 20 }}>Результаты по сезонам</h3>
              <div className={styles.passportForm}>
                <div className={styles.formGrid}>
                  <label className={styles.formLabel}>
                    Сезон
                    <input className={styles.formInput} value={seasonName} onChange={e => setSeasonName(e.target.value)} placeholder="2024/2025" />
                  </label>
                  <label className={styles.formLabel}>
                    Культура
                    <input className={styles.formInput} value={seasonCrop} onChange={e => setSeasonCrop(e.target.value)} placeholder="wheat" />
                  </label>
                  <label className={styles.formLabel}>
                    Урожай факт, т/га
                    <input className={styles.formInput} value={seasonYieldAct} onChange={e => setSeasonYieldAct(e.target.value)} />
                  </label>
                  <label className={styles.formLabel}>
                    Урожай план, т/га
                    <input className={styles.formInput} value={seasonYieldPlan} onChange={e => setSeasonYieldPlan(e.target.value)} />
                  </label>
                  <label className={styles.formLabel}>
                    Выручка, ₽
                    <input className={styles.formInput} value={seasonRevenue} onChange={e => setSeasonRevenue(e.target.value)} />
                  </label>
                  <label className={styles.formLabel}>
                    Затраты, ₽
                    <input className={styles.formInput} value={seasonCost} onChange={e => setSeasonCost(e.target.value)} />
                  </label>
                </div>
                <div className={styles.formActions}>
                  <Button type="button" size="sm" variant="secondary" loading={passportSaving} onClick={() => void saveSeason()}>
                    {editingSeasonId ? 'Сохранить сезон' : 'Добавить сезон'}
                  </Button>
                  {editingSeasonId && (
                    <Button type="button" size="sm" variant="ghost" onClick={resetSeasonForm}>Отмена</Button>
                  )}
                </div>
              </div>
              {passport.results.length > 0 && (
                <div className={styles.table}>
                  {passport.results.map((r) => (
                    <div key={r.id ?? r.season} className={styles.rowSeason}>
                      <span>{r.season}</span>
                      <span>
                        Факт: {r.yieldActual ?? '—'} т/га (план: {r.yieldPlan ?? '—'})
                        {r.cropType ? ` · ${r.cropType}` : ''}
                      </span>
                      <span>Выручка: {r.revenueActual != null ? money(r.revenueActual) : '—'}</span>
                      <span>Затраты: {r.costActual != null ? money(r.costActual) : '—'}</span>
                      <span className={styles.rowActions}>
                        {r.id && (
                          <>
                            <button type="button" className={styles.linkBtn} onClick={() => startEditSeason(r)}>Изменить</button>
                            <button type="button" className={styles.linkBtnDanger} onClick={() => void removeSeason(r.id!)}>Удалить</button>
                          </>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {!passport.results.length && (
                <p className={styles.emptyHint}>Нет строк по сезонам — добавьте фактические итоги урожая.</p>
              )}
            </Card>

            <Card>
              <h3 className={styles.sectionTitle}>Динамика вегетации и влажности</h3>
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
