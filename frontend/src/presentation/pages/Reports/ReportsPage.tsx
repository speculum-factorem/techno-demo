import React, { useCallback, useEffect, useMemo, useState } from 'react'
import styles from './ReportsPage.module.scss'
import { opsApi, ReportHistoryItem, ScheduledReport } from '@infrastructure/api/OpsApi'

interface ReportTemplate {
  id: string
  name: string
  description: string
  icon: string
  category: 'analytics' | 'finance' | 'operations' | 'compliance'
  formats: ('pdf' | 'excel')[]
  frequency?: 'weekly' | 'monthly'
  lastGenerated?: string
  pages?: number
}

const TEMPLATES: ReportTemplate[] = [
  { id: 'r1', name: 'Недельный дайджест', description: 'Сводка по всем полям: урожай, полив, алерты, погода за неделю', icon: 'summarize', category: 'analytics', formats: ['pdf', 'excel'], frequency: 'weekly', lastGenerated: '2026-03-19', pages: 12 },
  { id: 'r2', name: 'Финансовая сводка', description: 'Себестоимость, экономия воды, ROI, маржинальность по культурам', icon: 'account_balance', category: 'finance', formats: ['pdf', 'excel'], frequency: 'monthly', lastGenerated: '2026-02-28', pages: 8 },
  { id: 'r3', name: 'Прогноз урожая', description: 'Детальный прогноз RandomForest с метриками по каждому полю', icon: 'trending_up', category: 'analytics', formats: ['pdf'], lastGenerated: '2026-03-15', pages: 18 },
  { id: 'r4', name: 'Отчёт по поливу', description: 'Объёмы полива, рекомендации, принятые/отклонённые решения', icon: 'water_drop', category: 'operations', formats: ['pdf', 'excel'], lastGenerated: '2026-03-18', pages: 6 },
  { id: 'r5', name: 'Аудит действий', description: 'Журнал всех действий пользователей за выбранный период', icon: 'manage_history', category: 'compliance', formats: ['pdf', 'excel'] },
  { id: 'r6', name: 'Состояние техники', description: 'SLA устройств, аптайм, качество данных, алерты по сенсорам', icon: 'device_hub', category: 'operations', formats: ['pdf', 'excel'], lastGenerated: '2026-03-20', pages: 5 },
  { id: 'r7', name: 'Спутниковый отчёт NDVI/NDMI', description: 'Динамика индексов, зоны стресса, тренды по полям', icon: 'satellite_alt', category: 'analytics', formats: ['pdf'] },
  { id: 'r8', name: 'Ежемесячный отчёт для руководства', description: 'Исполнительное резюме: KPI, финансы, прогнозы, риски', icon: 'business_center', category: 'compliance', formats: ['pdf'], frequency: 'monthly', lastGenerated: '2026-02-28', pages: 24 },
]

const CATEGORY_LABELS: Record<string, string> = {
  analytics: 'Аналитика', finance: 'Финансы', operations: 'Операции', compliance: 'Отчётность',
}
const CATEGORY_COLORS: Record<string, string> = {
  analytics: '#1a73e8', finance: '#34a853', operations: '#f9ab00', compliance: '#9c27b0',
}

function parseRecipients(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map(s => s.trim())
    .filter(Boolean)
}

function apiErr(e: unknown, fallback: string): string {
  const ex = e as { response?: { data?: { detail?: string; message?: string } } }
  const d = ex.response?.data
  const detail = d?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  const msg = d?.message
  if (typeof msg === 'string' && msg.trim()) return msg
  return fallback
}

const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'templates' | 'scheduled' | 'history'>('templates')
  const [filterCat, setFilterCat] = useState<string>('all')
  const [generating, setGenerating] = useState<string | null>(null)
  const [showSchedule, setShowSchedule] = useState(false)
  const [history, setHistory] = useState<ReportHistoryItem[]>([])
  const [scheduled, setScheduled] = useState<ScheduledReport[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
  const [scheduleTemplateId, setScheduleTemplateId] = useState(TEMPLATES[0].id)
  const [scheduleFrequency, setScheduleFrequency] = useState<'weekly' | 'monthly'>('weekly')
  const [scheduleFormat, setScheduleFormat] = useState<'pdf' | 'excel'>('pdf')
  const [scheduleRecipients, setScheduleRecipients] = useState('')
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleFormError, setScheduleFormError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setListError(null)
    setListLoading(true)
    try {
      const [h, sch] = await Promise.all([opsApi.getReportsHistory(), opsApi.getScheduledReports()])
      setHistory(h)
      setScheduled(sch)
    } catch {
      setListError('Не удалось загрузить отчёты или расписание. Проверьте API и авторизацию.')
      setHistory([])
      setScheduled([])
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!toast || toast.type !== 'ok') return
    const t = window.setTimeout(() => setToast(null), 6000)
    return () => window.clearTimeout(t)
  }, [toast])

  const filtered = TEMPLATES.filter(t => filterCat === 'all' || t.category === filterCat)

  const uniqueRecipientCount = useMemo(() => {
    const s = new Set<string>()
    scheduled.forEach(x => x.recipients.forEach(r => s.add(r.toLowerCase())))
    return s.size
  }, [scheduled])

  const openNewScheduleModal = () => {
    setEditingScheduleId(null)
    setScheduleTemplateId(TEMPLATES[0].id)
    setScheduleFrequency('weekly')
    setScheduleFormat('pdf')
    setScheduleRecipients('')
    setScheduleFormError(null)
    setShowSchedule(true)
  }

  const openEditSchedule = (s: ScheduledReport) => {
    setEditingScheduleId(s.id)
    setScheduleTemplateId(s.templateId)
    setScheduleFrequency(s.frequency)
    setScheduleFormat(s.format)
    setScheduleRecipients(s.recipients.join(', '))
    setScheduleFormError(null)
    setShowSchedule(true)
  }

  const saveSchedule = async () => {
    setScheduleFormError(null)
    const recipients = parseRecipients(scheduleRecipients)
    if (recipients.length === 0) {
      setScheduleFormError('Укажите хотя бы один email получателя')
      return
    }
    const tpl = TEMPLATES.find(t => t.id === scheduleTemplateId)
    const name = tpl?.name || 'Отчёт'
    setScheduleSaving(true)
    try {
      if (editingScheduleId) {
        await opsApi.updateScheduledReport(editingScheduleId, {
          templateId: scheduleTemplateId,
          name,
          frequency: scheduleFrequency,
          format: scheduleFormat,
          channel: 'email',
          recipients,
        })
        setToast({ type: 'ok', text: 'Расписание обновлено и сохранено на сервере.' })
      } else {
        await opsApi.createScheduledReport({
          templateId: scheduleTemplateId,
          name,
          frequency: scheduleFrequency,
          format: scheduleFormat,
          channel: 'email',
          recipients,
        })
        setToast({ type: 'ok', text: 'Расписание создано и сохранено на сервере.' })
      }
      setShowSchedule(false)
      await loadData()
    } catch (e) {
      setScheduleFormError(apiErr(e, 'Не удалось сохранить'))
    } finally {
      setScheduleSaving(false)
    }
  }

  const deleteSchedule = async (id: string) => {
    if (!window.confirm('Удалить это расписание?')) return
    try {
      await opsApi.deleteScheduledReport(id)
      setToast({ type: 'ok', text: 'Расписание удалено.' })
      await loadData()
    } catch (e) {
      setToast({ type: 'err', text: apiErr(e, 'Не удалось удалить') })
    }
  }

  const generate = async (templateId: string, format: 'pdf' | 'excel') => {
    const key = `${templateId}:${format}`
    setGenerating(key)
    const template = TEMPLATES.find(t => t.id === templateId)
    const name = template?.name || 'Отчёт'
    try {
      await opsApi.generateReport(name, format, templateId)
      await loadData()
      setToast({
        type: 'ok',
        text: `Отчёт «${name}» (${format.toUpperCase()}) сформирован и сохранён. Скачайте файл во вкладке «История».`,
      })
    } catch (e) {
      setToast({ type: 'err', text: apiErr(e, 'Не удалось сгенерировать отчёт') })
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}><span className="material-icons-round">description</span> Отчёты и экспорт</h1>
          <p className={styles.sub}>PDF и Excel для руководства, плановые рассылки на email</p>
        </div>
        <button type="button" className={styles.scheduleBtn} onClick={openNewScheduleModal}>
          <span className="material-icons-round">schedule_send</span> Настроить рассылку
        </button>
      </div>

      {listError && (
        <div className={styles.infoMsg} style={{ marginBottom: 16, borderColor: '#ea4335', background: '#fce8e6' }}>
          <span className="material-icons-round" style={{ color: '#ea4335' }}>error_outline</span> {listError}
        </div>
      )}
      {toast && (
        <div
          className={styles.infoMsg}
          style={{
            marginBottom: 16,
            borderColor: toast.type === 'ok' ? '#34a853' : '#ea4335',
            background: toast.type === 'ok' ? '#e6f4ea' : '#fce8e6',
          }}
        >
          <span className="material-icons-round" style={{ color: toast.type === 'ok' ? '#34a853' : '#ea4335' }}>
            {toast.type === 'ok' ? 'check_circle' : 'error_outline'}
          </span>
          {toast.text}
          <button type="button" className={styles.iconBtn} style={{ marginLeft: 8 }} onClick={() => setToast(null)} aria-label="Закрыть">
            <span className="material-icons-round">close</span>
          </button>
        </div>
      )}

      {/* Quick stats */}
      <div className={styles.statsRow}>
        {[
          { label: 'Шаблонов', value: TEMPLATES.length, icon: 'description', color: '#1a73e8' },
          { label: 'Плановых рассылок', value: listLoading ? '…' : scheduled.length, icon: 'schedule_send', color: '#34a853' },
          { label: 'В истории', value: listLoading ? '…' : history.length, icon: 'download_done', color: '#f9ab00' },
          { label: 'Получателей (уник.)', value: listLoading ? '…' : uniqueRecipientCount, icon: 'group', color: '#9c27b0' },
        ].map(s => (
          <div key={s.label} className={styles.statCard}>
            <span className="material-icons-round" style={{ color: s.color }}>{s.icon}</span>
            <strong style={{ color: s.color }}>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {(['templates', 'scheduled', 'history'] as const).map(tab => (
          <button key={tab} type="button" className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`} onClick={() => setActiveTab(tab)}>
            <span className="material-icons-round">
              {tab === 'templates' ? 'library_books' : tab === 'scheduled' ? 'schedule_send' : 'history'}
            </span>
            {tab === 'templates' ? 'Шаблоны' : tab === 'scheduled' ? 'Расписание' : 'История'}
          </button>
        ))}
      </div>

      {activeTab === 'templates' && (
        <>
          <div className={styles.catFilters}>
            <button type="button" className={`${styles.catBtn} ${filterCat === 'all' ? styles.activeCatBtn : ''}`} onClick={() => setFilterCat('all')}>Все</button>
            {Object.keys(CATEGORY_LABELS).map(c => (
              <button key={c} type="button" className={`${styles.catBtn} ${filterCat === c ? styles.activeCatBtn : ''}`}
                onClick={() => setFilterCat(c)}
                style={filterCat === c ? { background: CATEGORY_COLORS[c] + '22', color: CATEGORY_COLORS[c], borderColor: CATEGORY_COLORS[c] } : {}}>
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
          <div className={styles.templateGrid}>
            {filtered.map(t => (
              <div key={t.id} className={styles.templateCard}>
                <div className={styles.templateIcon} style={{ color: CATEGORY_COLORS[t.category] }}>
                  <span className="material-icons-round">{t.icon}</span>
                </div>
                <div className={styles.templateBody}>
                  <div className={styles.templateTop}>
                    <span className={styles.templateName}>{t.name}</span>
                    <span className={styles.catBadge} style={{ background: CATEGORY_COLORS[t.category] + '22', color: CATEGORY_COLORS[t.category] }}>
                      {CATEGORY_LABELS[t.category]}
                    </span>
                  </div>
                  <p className={styles.templateDesc}>{t.description}</p>
                  <div className={styles.templateMeta}>
                    {t.lastGenerated && <span><span className="material-icons-round" style={{ fontSize: 13 }}>schedule</span> {t.lastGenerated}</span>}
                    {t.pages && <span><span className="material-icons-round" style={{ fontSize: 13 }}>pages</span> {t.pages} стр.</span>}
                    {t.frequency && <span><span className="material-icons-round" style={{ fontSize: 13 }}>refresh</span> {t.frequency === 'weekly' ? 'Еженедельно' : 'Ежемесячно'}</span>}
                  </div>
                  <div className={styles.templateActions}>
                    {t.formats.includes('pdf') && (
                      <button type="button" className={`${styles.genBtn} ${styles.pdfBtn}`} onClick={() => void generate(t.id, 'pdf')} disabled={generating === `${t.id}:pdf`}>
                        {generating === `${t.id}:pdf` ? <span className={styles.spinner} /> : <span className="material-icons-round">picture_as_pdf</span>}
                        PDF
                      </button>
                    )}
                    {t.formats.includes('excel') && (
                      <button type="button" className={`${styles.genBtn} ${styles.xlsBtn}`} onClick={() => void generate(t.id, 'excel')} disabled={generating === `${t.id}:excel`}>
                        {generating === `${t.id}:excel` ? <span className={styles.spinner} /> : <span className="material-icons-round">table_chart</span>}
                        Excel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'scheduled' && (
        <div className={styles.scheduledList}>
          {listLoading && <p className={styles.sub}>Загрузка…</p>}
          {!listLoading && scheduled.map(s => (
            <div key={s.id} className={styles.scheduledCard}>
              <div className={styles.scheduledIcon}>
                <span className="material-icons-round" style={{ color: s.format === 'pdf' ? '#ea4335' : '#34a853' }}>
                  {s.format === 'pdf' ? 'picture_as_pdf' : 'table_chart'}
                </span>
              </div>
              <div className={styles.scheduledBody}>
                <div className={styles.scheduledName}>{s.name}</div>
                <div className={styles.scheduledMeta}>
                  <span><span className="material-icons-round" style={{ fontSize: 13 }}>refresh</span> {s.frequency === 'weekly' ? 'Еженедельно' : 'Ежемесячно'}</span>
                  <span><span className="material-icons-round" style={{ fontSize: 13 }}>event</span> Следующий: {s.nextRun}</span>
                  <span><span className="material-icons-round" style={{ fontSize: 13 }}>email</span> Email</span>
                  <span><span className="material-icons-round" style={{ fontSize: 13 }}>group</span> {s.recipients.join(', ')}</span>
                </div>
              </div>
              <div className={styles.scheduledActions}>
                <button type="button" className={styles.iconBtn} title="Изменить" onClick={() => openEditSchedule(s)}><span className="material-icons-round">edit</span></button>
                <button type="button" className={styles.iconBtn} title="Удалить" onClick={() => void deleteSchedule(s.id)}><span className="material-icons-round">delete</span></button>
              </div>
            </div>
          ))}
          {!listLoading && scheduled.length === 0 && <p className={styles.sub}>Нет плановых рассылок. Создайте через кнопку выше.</p>}
          <button type="button" className={styles.addScheduleBtn} onClick={openNewScheduleModal}>
            <span className="material-icons-round">add</span> Добавить расписание
          </button>
        </div>
      )}

      {activeTab === 'history' && (
        <div className={styles.historyList}>
          {listLoading && <p className={styles.sub}>Загрузка…</p>}
          {!listLoading && history.length === 0 && <p className={styles.sub}>История пуста — сгенерируйте отчёт на вкладке «Шаблоны».</p>}
          {!listLoading && history.map(h => (
            <div key={h.id} className={styles.historyItem}>
              <span className="material-icons-round" style={{ color: h.format === 'pdf' ? '#ea4335' : '#34a853', fontSize: 22 }}>
                {h.format === 'pdf' ? 'picture_as_pdf' : 'table_chart'}
              </span>
              <div className={styles.historyBody}>
                <span className={styles.historyName}>{h.name}</span>
                <span className={styles.historyMeta}>{h.date} · {h.size} · {h.user}</span>
              </div>
              <button type="button" className={styles.downloadBtn} title="Скачать PDF или Excel" onClick={() => void opsApi.downloadReportHistoryFile(h.id)}>
                <span className="material-icons-round">download</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {showSchedule && (
        <div className={styles.overlay} onClick={() => !scheduleSaving && setShowSchedule(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <span className="material-icons-round">schedule_send</span>
                {editingScheduleId ? 'Редактировать рассылку' : 'Новая рассылка'}
              </div>
              <button type="button" className={styles.closeBtn} disabled={scheduleSaving} onClick={() => setShowSchedule(false)}><span className="material-icons-round">close</span></button>
            </div>
            <div className={styles.modalBody}>
              {scheduleFormError && (
                <div className={styles.infoMsg} style={{ marginBottom: 12, borderColor: '#ea4335', background: '#fce8e6' }}>
                  <span className="material-icons-round" style={{ color: '#ea4335' }}>error_outline</span> {scheduleFormError}
                </div>
              )}
              <div className={styles.formGroup}><label>Шаблон отчёта</label>
                <select className={styles.select} value={scheduleTemplateId} onChange={e => setScheduleTemplateId(e.target.value)}>
                  {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}><label>Периодичность</label>
                  <select className={styles.select} value={scheduleFrequency} onChange={e => setScheduleFrequency(e.target.value as 'weekly' | 'monthly')}>
                    <option value="weekly">Еженедельно</option>
                    <option value="monthly">Ежемесячно</option>
                  </select>
                </div>
                <div className={styles.formGroup}><label>Формат</label>
                  <select className={styles.select} value={scheduleFormat} onChange={e => setScheduleFormat(e.target.value as 'pdf' | 'excel')}>
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel</option>
                  </select>
                </div>
              </div>
              <div className={styles.formGroup}><label>Получатели (email через запятую)</label>
                <input className={styles.input} placeholder="user1@company.ru, user2@company.ru" value={scheduleRecipients} onChange={e => setScheduleRecipients(e.target.value)} />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} disabled={scheduleSaving} onClick={() => setShowSchedule(false)}>Отмена</button>
                <button type="button" className={styles.saveBtn} disabled={scheduleSaving} onClick={() => void saveSchedule()}>
                  <span className="material-icons-round">save</span> {scheduleSaving ? 'Сохранение…' : editingScheduleId ? 'Сохранить' : 'Создать расписание'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReportsPage
